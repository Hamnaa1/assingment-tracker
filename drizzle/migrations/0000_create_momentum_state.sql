CREATE TABLE public.momentum_state (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.momentum_state TO authenticated;
GRANT ALL ON public.momentum_state TO service_role;
ALTER TABLE public.momentum_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own state select" ON public.momentum_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own state insert" ON public.momentum_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own state update" ON public.momentum_state FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own state delete" ON public.momentum_state FOR DELETE TO authenticated USING (auth.uid() = user_id);