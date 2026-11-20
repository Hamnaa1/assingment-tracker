import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Details = { client?: { name?: string; client_name?: string }; redirect_uri?: string; scope?: string; redirect_url?: string; redirect_to?: string };
type Res = { data: Details | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Res>;
  approveAuthorization: (id: string) => Promise<Res>;
  denyAuthorization: (id: string) => Promise<Res>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<Details | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("This connection link is missing its request ID.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
        return;
      }
      setEmail(sess.session.user.email ?? "");
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) { window.location.href = immediate; return; }
        setDetails(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load this request.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve ? await oauth().approveAuthorization(authorizationId) : await oauth().denyAuthorization(authorizationId);
      if (error) throw new Error(error.message);
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) throw new Error("No redirect was returned.");
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  const name = details?.client?.name ?? details?.client?.client_name ?? "An assistant";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {error ? (
          <p className="text-sm text-destructive">Could not load this connection request: {error}</p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">Connect {name} to Momentum</h1>
            <p className="mb-4 text-sm text-muted-foreground">Signed in as {email}</p>
            <p className="mb-3 text-sm">{name} will be able to view your assignments and tasks, add tasks, and mark tasks done — acting as you.</p>
            <ul className="mb-3 list-disc pl-5 text-sm text-muted-foreground">
              <li>Share your basic profile and email address</li>
              {details.redirect_uri && <li>Returns to: {new URL(details.redirect_uri).host}</li>}
            </ul>
            <p className="mb-6 text-xs text-muted-foreground">This does not bypass Momentum's permissions — it only sees your own data.</p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => decide(true)}>Approve</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
