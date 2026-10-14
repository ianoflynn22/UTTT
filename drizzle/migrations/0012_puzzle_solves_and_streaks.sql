CREATE TABLE public.puzzle_solves (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  tries int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.puzzle_solves TO authenticated;
GRANT ALL ON public.puzzle_solves TO service_role;
ALTER TABLE public.puzzle_solves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own solves" ON public.puzzle_solves FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.puzzle_streaks()
RETURNS TABLE (user_id uuid, username text, country text, current_streak int, best_streak int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH runs AS (
    SELECT s.user_id, min(s.day) AS start_day, max(s.day) AS end_day, count(*)::int AS len
    FROM (SELECT ps.user_id, ps.day, ps.day - (row_number() OVER (PARTITION BY ps.user_id ORDER BY ps.day))::int AS grp FROM public.puzzle_solves ps) s
    GROUP BY s.user_id, s.grp
  ), agg AS (
    SELECT r.user_id,
      max(r.len) AS best,
      coalesce(max(r.len) FILTER (WHERE r.end_day >= (now() AT TIME ZONE 'utc')::date - 1), 0) AS cur
    FROM runs r GROUP BY r.user_id
  )
  SELECT a.user_id, p.username, p.country, a.cur::int, a.best::int
  FROM agg a JOIN public.profiles p ON p.id = a.user_id
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.puzzle_streaks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.puzzle_streaks() TO authenticated;