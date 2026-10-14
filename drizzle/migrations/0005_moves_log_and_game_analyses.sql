ALTER TABLE public.games ADD COLUMN IF NOT EXISTS moves jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.games.moves IS 'Ordered online move log: [{"p":"X","b":0,"c":0}, ...]';

CREATE TABLE IF NOT EXISTS public.game_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);
GRANT SELECT, INSERT ON public.game_analyses TO authenticated;
GRANT ALL ON public.game_analyses TO service_role;
ALTER TABLE public.game_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own analyses"
  ON public.game_analyses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Players save own analyses"
  ON public.game_analyses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);