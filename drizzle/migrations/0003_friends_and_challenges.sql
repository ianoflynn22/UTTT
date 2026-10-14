-- Allow a waiting challenge state on games
ALTER TABLE public.games DROP CONSTRAINT games_status_check;
ALTER TABLE public.games ADD CONSTRAINT games_status_check CHECK (status IN ('waiting','active','finished','abandoned'));

ALTER TABLE public.games ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends see their own friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressees can accept requests"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);
CREATE POLICY "Users can cancel or decline requests"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE INDEX idx_games_player_x ON public.games (player_x, status);
CREATE INDEX idx_games_player_o ON public.games (player_o, status);

-- Challenge a friend directly (creates a waiting game both can see)
CREATE OR REPLACE FUNCTION public.challenge_friend(_friend_id uuid, _mode text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  gid uuid;
BEGIN
  IF me IS NULL OR _friend_id IS NULL OR me = _friend_id THEN
    RAISE EXCEPTION 'INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = me AND f.addressee_id = _friend_id)
        OR (f.requester_id = _friend_id AND f.addressee_id = me))
  ) THEN
    RAISE EXCEPTION 'NOT_FRIENDS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.mode = _mode AND g.status IN ('waiting','active')
      AND ((g.player_x = me AND g.player_o = _friend_id)
        OR (g.player_x = _friend_id AND g.player_o = me))
  ) THEN
    RAISE EXCEPTION 'GAME_EXISTS';
  END IF;
  IF random() < 0.5 THEN
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (_mode, public.initial_state(_mode), 'waiting', me, _friend_id)
    RETURNING id INTO gid;
  ELSE
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (_mode, public.initial_state(_mode), 'waiting', _friend_id, me)
    RETURNING id INTO gid;
  END IF;
  RETURN gid;
END $$;

REVOKE EXECUTE ON FUNCTION public.challenge_friend(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.challenge_friend(uuid, text) TO authenticated;

-- Accept or decline a challenge (either player may cancel while waiting)
CREATE OR REPLACE FUNCTION public.respond_challenge(_game_id uuid, _accept boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  g public.games%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  SELECT * INTO g FROM public.games WHERE id = _game_id AND status = 'waiting';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF g.player_x <> me AND g.player_o <> me THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF _accept THEN
    UPDATE public.games SET status = 'active', updated_at = now() WHERE id = _game_id;
    RETURN _game_id;
  ELSE
    DELETE FROM public.games WHERE id = _game_id;
    RETURN NULL;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.respond_challenge(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_challenge(uuid, boolean) TO authenticated;