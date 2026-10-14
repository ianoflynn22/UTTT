-- Accepting a shared challenge link makes inviter and visitor friends, returning the inviter id.
CREATE OR REPLACE FUNCTION public.accept_invite_link(_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  inviter uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'INVALID'; END IF;
  SELECT id INTO inviter FROM public.profiles WHERE lower(username) = lower(_username);
  IF inviter IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF inviter = me THEN RAISE EXCEPTION 'SELF'; END IF;
  UPDATE public.friendships SET status = 'accepted', updated_at = now()
    WHERE (requester_id = me AND addressee_id = inviter) OR (requester_id = inviter AND addressee_id = me);
  IF NOT FOUND THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (inviter, me, 'accepted');
  END IF;
  RETURN inviter;
END $$;
REVOKE ALL ON FUNCTION public.accept_invite_link(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite_link(text) TO authenticated;