DROP POLICY IF EXISTS "Profiles are public" ON public.profiles;
CREATE POLICY "Signed-in users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;