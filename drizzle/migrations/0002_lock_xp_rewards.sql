DROP POLICY IF EXISTS "Signed-in students can read reward values" ON public.xp_rewards;
REVOKE SELECT ON public.xp_rewards FROM authenticated, anon;