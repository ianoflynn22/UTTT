CREATE OR REPLACE FUNCTION public.apply_elo_result(_game_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  g public.games%ROWTYPE;
  ra float; rb float; ea float; eb float; sa float; sb float;
  new_x int; new_o int;
  k constant float := 32;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = _game_id AND status = 'finished' AND elo_applied = false;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Friend challenges / shared links (created_by set) are unrated; matchmaking games are rated.
  IF g.created_by IS NOT NULL THEN
    UPDATE public.games SET elo_applied = true WHERE id = _game_id;
    RETURN NULL;
  END IF;
  SELECT elo INTO ra FROM public.ratings WHERE user_id = g.player_x AND mode = g.mode;
  SELECT elo INTO rb FROM public.ratings WHERE user_id = g.player_o AND mode = g.mode;
  IF ra IS NULL OR rb IS NULL THEN RETURN NULL; END IF;
  ea := 1 / (1 + power(10, (rb - ra) / 400));
  eb := 1 / (1 + power(10, (ra - rb) / 400));
  IF g.winner = 'X' THEN sa := 1; sb := 0;
  ELSIF g.winner = 'O' THEN sa := 0; sb := 1;
  ELSE sa := 0.5; sb := 0.5; END IF;
  new_x := round(ra + k * (sa - ea))::int;
  new_o := round(rb + k * (sb - eb))::int;
  UPDATE public.ratings SET elo = new_x, games = games + 1,
    wins = wins + (CASE WHEN sa = 1 THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN sa = 0 THEN 1 ELSE 0 END),
    draws = draws + (CASE WHEN sa = 0.5 THEN 1 ELSE 0 END)
  WHERE user_id = g.player_x AND mode = g.mode;
  UPDATE public.ratings SET elo = new_o, games = games + 1,
    wins = wins + (CASE WHEN sb = 1 THEN 1 ELSE 0 END),
    losses = losses + (CASE WHEN sb = 0 THEN 1 ELSE 0 END),
    draws = draws + (CASE WHEN sb = 0.5 THEN 1 ELSE 0 END)
  WHERE user_id = g.player_o AND mode = g.mode;
  UPDATE public.games SET elo_applied = true, elo_delta_x = new_x - ra::int, elo_delta_o = new_o - rb::int WHERE id = _game_id;
  RETURN jsonb_build_object('x', new_x, 'o', new_o);
END $function$;

CREATE OR REPLACE FUNCTION public.delete_friend_game(_game_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  DELETE FROM public.game_analyses WHERE game_id = _game_id;
  DELETE FROM public.games WHERE id = _game_id AND created_by IS NOT NULL
    AND status IN ('waiting','active') AND (player_x = me OR player_o = me);
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_friend_game(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_friend_game(uuid) TO authenticated;