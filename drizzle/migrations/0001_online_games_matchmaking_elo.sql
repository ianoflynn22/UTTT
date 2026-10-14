-- Online games
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  state jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','abandoned')),
  player_x uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_o uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  winner text CHECK (winner IN ('X','O')),
  move_seq integer NOT NULL DEFAULT 0,
  elo_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Matchmaking queue
CREATE TABLE public.matchmaking_queue (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mode)
);

GRANT SELECT ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT SELECT, DELETE ON public.matchmaking_queue TO authenticated;
GRANT ALL ON public.matchmaking_queue TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view their games"
  ON public.games FOR SELECT TO authenticated
  USING (auth.uid() = player_x OR auth.uid() = player_o);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own queue entries"
  ON public.matchmaking_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can leave the queue"
  ON public.matchmaking_queue FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime updates for live games
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

-- Initial GameState JSON matching src/lib/game.ts newGame()
CREATE OR REPLACE FUNCTION public.initial_state(_mode text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH d AS (
    SELECT
      CASE WHEN _mode IN ('ttt','ultimate') THEN 3 ELSE 4 END AS size,
      _mode IN ('ultimate','ultimateplus') AS ultimate,
      CASE WHEN _mode IN ('ultimate','ultimateplus') THEN
        CASE WHEN _mode IN ('ttt','ultimate') THEN 9 ELSE 16 END
      ELSE 1 END AS count
  )
  SELECT jsonb_build_object(
    'mode', _mode,
    'size', d.size,
    'ultimate', d.ultimate,
    'boards', CASE WHEN d.ultimate
      THEN to_jsonb(array(
        SELECT to_jsonb(array_fill(null::text, array[d.size * d.size]))
        FROM generate_series(1, d.size * d.size)
      ))
      ELSE to_jsonb(array_fill(null::text, array[d.size * d.size])) END,
    'completed', to_jsonb(array_fill(null::text, array[d.count])),
    'meta', to_jsonb(array_fill(null::text, array[d.count])),
    'localPlus', to_jsonb(array_fill(0, array[d.count])),
    'metaPlus', 0,
    'target', null::text,
    'current', 'X',
    'winner', null::text,
    'over', false,
    'lastMove', null::text
  )
  FROM d
$$;

-- Atomically match two queued players (or enqueue the caller)
CREATE OR REPLACE FUNCTION public.find_or_create_match(_mode text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  opp uuid;
  gid uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Already in an active game of this mode? Resume it.
  SELECT id INTO gid FROM public.games
  WHERE status = 'active' AND (player_x = me OR player_o = me) AND mode = _mode
  ORDER BY created_at DESC
  LIMIT 1;
  IF gid IS NOT NULL THEN
    RETURN gid;
  END IF;

  SELECT mq.user_id INTO opp
  FROM public.matchmaking_queue mq
  WHERE mq.mode = _mode
    AND mq.user_id <> me
    AND mq.created_at > now() - interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.status = 'active'
        AND (g.player_x = mq.user_id OR g.player_o = mq.user_id)
        AND g.mode = _mode
    )
  ORDER BY mq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF opp IS NOT NULL THEN
    DELETE FROM public.matchmaking_queue WHERE user_id = opp AND mode = _mode;
    DELETE FROM public.matchmaking_queue WHERE user_id = me AND mode = _mode;
    IF random() < 0.5 THEN
      INSERT INTO public.games (mode, state, status, player_x, player_o)
      VALUES (_mode, public.initial_state(_mode), 'active', opp, me)
      RETURNING id INTO gid;
    ELSE
      INSERT INTO public.games (mode, state, status, player_x, player_o)
      VALUES (_mode, public.initial_state(_mode), 'active', me, opp)
      RETURNING id INTO gid;
    END IF;
    RETURN gid;
  END IF;

  INSERT INTO public.matchmaking_queue (user_id, mode)
  VALUES (me, _mode)
  ON CONFLICT (user_id, mode) DO UPDATE SET created_at = now();
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.find_or_create_match(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_match(text) TO authenticated;

-- Apply Elo (K=32) once for a finished game; server-validated games call this
CREATE OR REPLACE FUNCTION public.apply_elo_result(_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.games%ROWTYPE;
  ra float; rb float; ea float; eb float; sa float; sb float;
  new_x int; new_o int;
  k constant float := 32;
BEGIN
  SELECT * INTO g FROM public.games
  WHERE id = _game_id AND status = 'finished' AND elo_applied = false;
  IF NOT FOUND OR g.winner IS NULL AND false THEN
    RETURN NULL;
  END IF;
  IF g.winner IS NOT NULL AND g.player_o IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT elo INTO ra FROM public.ratings WHERE user_id = g.player_x AND mode = g.mode;
  SELECT elo INTO rb FROM public.ratings WHERE user_id = g.player_o AND mode = g.mode;
  IF ra IS NULL OR rb IS NULL THEN
    RETURN NULL;
  END IF;

  ea := 1 / (1 + power(10, (rb - ra) / 400));
  eb := 1 / (1 + power(10, (ra - rb) / 400));
  IF g.winner = 'X' THEN sa := 1; sb := 0;
  ELSIF g.winner = 'O' THEN sa := 0; sb := 1;
  ELSE sa := 0.5; sb := 0.5;
  END IF;

  new_x := round(ra + k * (sa - ea))::int;
  new_o := round(rb + k * (sb - eb))::int;

  UPDATE public.ratings SET
    elo = new_x,
    games = games + 1,
    wins = wins + (CASE WHEN sa = 1 THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN sa = 0 THEN 1 ELSE 0 END),
    draws = draws + (CASE WHEN sa = 0.5 THEN 1 ELSE 0 END)
  WHERE user_id = g.player_x AND mode = g.mode;

  UPDATE public.ratings SET
    elo = new_o,
    games = games + 1,
    wins = wins + (CASE WHEN sb = 1 THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN sb = 0 THEN 1 ELSE 0 END),
    draws = draws + (CASE WHEN sb = 0.5 THEN 1 ELSE 0 END)
  WHERE user_id = g.player_o AND mode = g.mode;

  UPDATE public.games SET elo_applied = true WHERE id = _game_id;

  RETURN jsonb_build_object('x', new_x, 'o', new_o);
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_elo_result(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_elo_result(uuid) TO authenticated;