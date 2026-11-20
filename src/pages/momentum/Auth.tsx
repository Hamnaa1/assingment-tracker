import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useMomentum } from "@/lib/momentum/store";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Auth() {
  const [params] = useSearchParams();
  const next = oauthReturnPath(params.get("next") ?? "/dashboard");
  const target = next === "/" ? "/dashboard" : next;
  const navigate = useNavigate();
  const { session } = useMomentum();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (session) {
      if (target.startsWith("/.lovable/")) window.location.href = target;
      else navigate(target, { replace: true });
    }
  }, [session, target, navigate]);

  const absolute = new URL(target, window.location.origin).href;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: absolute } });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: absolute });
    if (res.error) toast.error(res.error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-lavender">
            <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <p className="font-extrabold tracking-tight">MOMENTUM</p>
            <p className="text-xs text-muted-foreground">Plan smarter. Submit stronger.</p>
          </div>
        </div>
        <h1 className="mb-1 text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mb-6 text-sm text-muted-foreground">Your assignments are saved to your account.</p>
        {sent ? (
          <p className="text-sm">Check your email to confirm your account, then come back to sign in.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-2">
              <Button variant="outline" onClick={() => social("google")}>Continue with Google</Button>
              <Button variant="outline" onClick={() => social("lovable")}>Continue with Lovable</Button>
            </div>
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>{mode === "signin" ? "Sign in" : "Sign up"}</Button>
            </form>
            <button className="mt-4 text-sm text-muted-foreground underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
