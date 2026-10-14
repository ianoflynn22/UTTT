CREATE OR REPLACE FUNCTION public.username_is_blocked(_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(lower(coalesce(_name,'')), '013457@$_', 'oieastas') ~
    '(nigg|niga|faggot|fagot|retard|tranny|kike|chink|wetback|gook|raghead|towelhead|beaner|hitler|kkk|cunt|rapist|negro)'
$$;

CREATE OR REPLACE FUNCTION public.enforce_username_filter()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.username_is_blocked(NEW.username) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.username := 'player_' || substr(md5(random()::text), 1, 8);
    ELSE
      RAISE EXCEPTION 'USERNAME_BLOCKED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_username_filter ON public.profiles;
CREATE TRIGGER profiles_username_filter
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_filter();