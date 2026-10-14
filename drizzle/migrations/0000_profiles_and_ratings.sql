CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  CONSTRAINT country_format CHECK (country IS NULL OR country ~ '^[A-Z]{2}$')
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE (username, country) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.ratings (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('ttt','tttplus','ultimate','ultimateplus')),
  elo integer NOT NULL DEFAULT 1200,
  games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mode)
);
GRANT SELECT ON public.ratings TO anon, authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings are public" ON public.ratings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  uname text;
BEGIN
  base := regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'player'), '[^A-Za-z0-9_]', '', 'g');
  IF length(base) < 3 THEN base := 'player'; END IF;
  base := left(base, 14);
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(uname)) LOOP
    uname := base || floor(random() * 100000)::int;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, uname);
  INSERT INTO public.ratings (user_id, mode)
    SELECT NEW.id, m FROM unnest(ARRAY['ttt','tttplus','ultimate','ultimateplus']) AS m;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();