-- Rematch the player you just finished a game against, without needing to be friends first.
CREATE OR REPLACE FUNCTION public.rematch_opponent(_game_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); g public.games%ROWTYPE; opp uuid; gid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO g FROM public.games WHERE id = _game_id;
  IF NOT FOUND OR g.status <> 'finished' THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF g.player_x <> me AND g.player_o <> me THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  opp := CASE WHEN g.player_x = me THEN g.player_o ELSE g.player_x END;
  IF opp IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF public.is_blocked(me, opp) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF EXISTS (SELECT 1 FROM public.games WHERE mode = g.mode AND status IN ('waiting','active')
      AND ((player_x = me AND player_o = opp) OR (player_x = opp AND player_o = me))) THEN
    RAISE EXCEPTION 'GAME_EXISTS';
  END IF;
  IF random() < 0.5 THEN
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (g.mode, public.initial_state(g.mode), 'waiting', me, opp, me) RETURNING id INTO gid;
  ELSE
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (g.mode, public.initial_state(g.mode), 'waiting', opp, me, me) RETURNING id INTO gid;
  END IF;
  RETURN gid;
END
$function$
;

REVOKE ALL ON FUNCTION public.rematch_opponent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rematch_opponent(uuid) TO authenticated;