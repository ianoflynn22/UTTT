CREATE OR REPLACE FUNCTION public.challenge_friend(_friend_id uuid, _mode text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); gid uuid;
BEGIN
  IF me IS NULL OR _friend_id IS NULL OR me = _friend_id THEN RAISE EXCEPTION 'INVALID'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status = 'accepted'
      AND ((f.requester_id = me AND f.addressee_id = _friend_id) OR (f.requester_id = _friend_id AND f.addressee_id = me))) THEN
    RAISE EXCEPTION 'NOT_FRIENDS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.games g WHERE g.mode = _mode AND g.status IN ('waiting','active')
      AND ((g.player_x = me AND g.player_o = _friend_id) OR (g.player_x = _friend_id AND g.player_o = me))) THEN
    RAISE EXCEPTION 'GAME_EXISTS';
  END IF;
  IF random() < 0.5 THEN
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (_mode, public.initial_state(_mode), 'waiting', me, _friend_id, me) RETURNING id INTO gid;
  ELSE
    INSERT INTO public.games (mode, state, status, player_x, player_o, created_by)
    VALUES (_mode, public.initial_state(_mode), 'waiting', _friend_id, me, me) RETURNING id INTO gid;
  END IF;
  RETURN gid;
END $function$;

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'blocked'
  AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))) $$;

CREATE OR REPLACE FUNCTION public.block_user(_other uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR _other IS NULL OR me = _other THEN RAISE EXCEPTION 'INVALID'; END IF;
  DELETE FROM public.friendships WHERE (requester_id = me AND addressee_id = _other) OR (requester_id = _other AND addressee_id = me);
  DELETE FROM public.games WHERE status = 'waiting' AND ((player_x = me AND player_o = _other) OR (player_x = _other AND player_o = me));
  INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (me, _other, 'blocked');
END $$;

CREATE OR REPLACE FUNCTION public.accept_invite_link(_username text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); inviter uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'INVALID'; END IF;
  SELECT id INTO inviter FROM public.profiles WHERE lower(username) = lower(_username);
  IF inviter IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF inviter = me THEN RAISE EXCEPTION 'SELF'; END IF;
  IF public.is_blocked(me, inviter) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.friendships SET status = 'accepted', updated_at = now()
    WHERE (requester_id = me AND addressee_id = inviter) OR (requester_id = inviter AND addressee_id = me);
  IF NOT FOUND THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (inviter, me, 'accepted');
  END IF;
  RETURN inviter;
END $function$;

CREATE OR REPLACE FUNCTION public.join_lobby(_game_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); g public.games%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO g FROM public.games WHERE id = _game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'waiting' OR g.player_o IS NOT NULL OR g.updated_at < now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'LOBBY_CLOSED';
  END IF;
  IF g.created_by = me THEN RAISE EXCEPTION 'SELF'; END IF;
  IF public.is_blocked(me, g.created_by) THEN RAISE EXCEPTION 'LOBBY_CLOSED'; END IF;
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
END $function$;

REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Addressees can accept requests" ON public.friendships;
CREATE POLICY "Addressees can accept requests" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id AND status = 'pending') WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND status = 'pending' AND NOT public.is_blocked(requester_id, addressee_id));
DROP POLICY IF EXISTS "Users can cancel or decline requests" ON public.friendships;
CREATE POLICY "Users can cancel or decline requests" ON public.friendships FOR DELETE TO authenticated
  USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id AND status <> 'blocked'));
DROP POLICY IF EXISTS "Friends see their own friendships" ON public.friendships;
CREATE POLICY "Friends see their own friendships" ON public.friendships FOR SELECT TO authenticated
  USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id AND status <> 'blocked'));