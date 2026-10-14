CREATE OR REPLACE FUNCTION public.username_is_blocked(_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(lower(coalesce(_name,'')), '013457@$_', 'oieastas') ~
    '(nigg|niga|faggot|fagot|retard|tranny|kike|chink|wetback|gook|raghead|towelhead|beaner|hitler|kkk|rapist|negro)'
$$;