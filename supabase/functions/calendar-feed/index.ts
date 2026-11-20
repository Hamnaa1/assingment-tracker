// Fetches a student's private calendar link (iCal/ICS) server-side so the browser
// can read it without CORS issues. Signed-in users only; returns the raw calendar text.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_BYTES = 3 * 1024 * 1024;

function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return true; // no raw IPs
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in required" }, 401);
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } });
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: claims, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !claims?.claims?.sub) {
    console.error("calendar-feed auth failed", authError?.message);
    return json({ error: "Sign in required" }, 401);
  }

  let raw: unknown;
  try {
    raw = (await req.json())?.url;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (typeof raw !== "string" || raw.length > 2000) return json({ error: "Enter a calendar link" }, 400);
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return json({ error: "That doesn't look like a valid link" }, 400);
  }
  if (url.protocol !== "https:" || isBlockedHost(url.hostname)) {
    return json({ error: "Use the secure (https or webcal) calendar link from your calendar app" }, 400);
  }

  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { Accept: "text/calendar, text/plain, */*" } });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return json({ error: "Your calendar provider refused the link. It may have been reset or made private — copy a fresh link." }, 422);
    }
    if (!res.ok) return json({ error: `Your calendar provider returned an error (${res.status}). Try again later.` }, 502);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return json({ error: "This calendar is too large to import" }, 413);
    const text = await res.text();
    if (text.length > MAX_BYTES) return json({ error: "This calendar is too large to import" }, 413);
    if (!text.includes("BEGIN:VCALENDAR")) {
      return json({ error: "That link isn't a calendar feed. Use the iCal / ICS address, not the web page link." }, 422);
    }
    return json({ ics: text });
  } catch (e) {
    console.error("calendar-feed fetch failed", e instanceof Error ? e.message : e);
    return json({ error: "Couldn't reach your calendar. Check the link and try again." }, 502);
  }
});
