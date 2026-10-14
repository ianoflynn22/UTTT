-- Daily puzzle: store the number of the player's own moves used to win (lower is better),
-- and expose today's best scores to signed-in players.
ALTER TABLE public.puzzle_solves ADD COLUMN IF NOT EXISTS moves integer;

CREATE OR REPLACE FUNCTION public.record_puzzle_solve(_user uuid, _day date, _moves integer, _tries integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user IS NULL OR _day IS NULL OR _moves IS NULL OR _moves < 1 OR _moves > 60 THEN
    RAISE EXCEPTION 'INVALID';
  END IF;
  INSERT INTO public.puzzle_solves (user_id, day, tries, moves)
  VALUES (_user, _day, GREATEST(1, LEAST(99, COALESCE(_tries, 1))), _moves)
  ON CONFLICT (user_id, day) DO UPDATE
    SET moves = LEAST(puzzle_solves.moves, EXCLUDED.moves),
        tries = LEAST(puzzle_solves.tries, EXCLUDED.tries);
END
$function$
;

CREATE OR REPLACE FUNCTION public.puzzle_day_scores(_day date)
 RETURNS TABLE(user_id uuid, username text, country text, moves integer, tries integer)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.user_id, p.username, p.country, s.moves, s.tries
  FROM public.puzzle_solves s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.day = _day AND s.moves IS NOT NULL AND auth.uid() IS NOT NULL
  ORDER BY s.moves ASC, s.created_at ASC
  LIMIT 25
$function$
;

REVOKE ALL ON FUNCTION public.record_puzzle_solve(uuid, date, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_puzzle_solve(uuid, date, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.puzzle_day_scores(date) TO authenticated;