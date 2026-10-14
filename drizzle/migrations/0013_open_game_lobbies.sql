CREATE OR REPLACE FUNCTION public.create_lobby(_mode text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); gid uuid;
BEGIN
  IF me IS NULL OR _mode NOT IN ('ttt','tttplus','ultimate','ultimateplus') THEN RAISE EXCEPTION 'INVALID'; END IF;
  DELETE FROM public.games WHERE created_by = me AND status = 'waiting' AND player_o IS NULL;
  INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
  VALUES (_mode, public.initial_state(_mode), 'waiting', me, NULL, me) RETURNING id INTO gid;
  RETURN gid;
END $$;

CREATE OR REPLACE FUNCTION public.lobby_heartbeat(_game_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.games SET updated_at = now()
  WHERE id = _game_id AND created_by = auth.uid() AND status = 'waiting' AND player_o IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.open_lobby(_username text)
RETURNS TABLE(game_id uuid, mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.id, g.mode FROM public.games g JOIN public.profiles p ON p.id = g.created_by
  WHERE lower(p.username) = lower(_username) AND g.status = 'waiting' AND g.player_o IS NULL
    AND g.updated_at > now() - interval '60 seconds'
  ORDER BY g.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.join_lobby(_game_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); g public.games%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO g FROM public.games WHERE id = _game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'waiting' OR g.player_o IS NOT NULL OR g.updated_at < now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'LOBBY_CLOSED';
  END IF;
  IF g.created_by = me THEN RAISE EXCEPTION 'SELF'; END IF;
  UPDATE public.friendships SET status = 'accepted', updated_at = now()
    WHERE (requester_id = me AND addressee_id = g.created_by) OR (requester_id = g.created_by AND addressee_id = me);
  IF NOT FOUND THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (g.created_by, me, 'accepted');
  END IF;
  IF random() < 0.5 THEN
    UPDATE public.games SET player_o = me, status = 'active', updated_at = now() WHERE id = _game_id;
  ELSE
    UPDATE public.games SET player_o = g.player_x, player_x = me, status = 'active', updated_at = now() WHERE id = _game_id;
  END IF;
  RETURN _game_id;
END $$;

REVOKE ALL ON FUNCTION public.create_lobby(text), public.lobby_heartbeat(uuid), public.join_lobby(uuid), public.open_lobby(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_lobby(text), public.lobby_heartbeat(uuid), public.join_lobby(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_lobby(text) TO anon, authenticated;