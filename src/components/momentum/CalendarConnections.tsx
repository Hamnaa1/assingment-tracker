import { useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMomentum } from "@/lib/momentum/store";
import { PROVIDER_INFO, fetchFeedEvents } from "@/lib/momentum/calendarSync";
import type { CalendarFeed, CalendarProvider } from "@/lib/momentum/types";
import { toast } from "sonner";

const PROVIDERS: CalendarProvider[] = ["google", "outlook", "apple"];

export function CalendarConnections() {
  const { state, dispatch, commit } = useMomentum();
  const feeds = state.calendarFeeds ?? [];
  const [connecting, setConnecting] = useState<CalendarProvider | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const connect = async () => {
    if (!connecting) return;
    if (!url.trim()) {
      toast.error("Paste your calendar link first");
      return;
    }
    const feed: CalendarFeed = { id: Math.random().toString(36).slice(2, 10), provider: connecting, label: PROVIDER_INFO[connecting].name, url: url.trim(), status: "pending" };
    setBusy("new");
    try {
      const events = await fetchFeedEvents(feed);
      dispatch({ type: "upsertFeed", feed: { ...feed, status: "ok", lastSyncedAt: new Date().toISOString() }, events });
      toast.success(`${feed.label} connected`, { description: `${events.length} upcoming events imported.` });
      setConnecting(null);
      setUrl("");
    } catch (e) {
      toast.error("Couldn't connect this calendar", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const sync = async (feed: CalendarFeed) => {
    setBusy(feed.id);
    try {
      const events = await fetchFeedEvents(feed);
      dispatch({ type: "upsertFeed", feed: { ...feed, status: "ok", error: undefined, lastSyncedAt: new Date().toISOString() }, events });
      toast.success(`${feed.label} synced`, { description: `${events.length} events.` });
    } catch (e) {
      dispatch({ type: "upsertFeed", feed: { ...feed, status: "error", error: (e as Error).message } });
      toast.error("Sync failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map((p) => {
        const connected = feeds.filter((f) => f.provider === p);
        return (
          <div key={p} className="rounded-lg border border-border/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{PROVIDER_INFO[p].name}</p>
                <p className="text-xs text-muted-foreground">{connected.length ? `${connected.length} calendar${connected.length > 1 ? "s" : ""} linked · read-only` : "Not connected"}</p>
              </div>
              <Button size="sm" variant={connected.length ? "outline" : "default"} className={connected.length ? "" : "bg-brand-lavender text-white hover:bg-brand-lavender/90"} onClick={() => setConnecting(p)}>
                <Link2 className="mr-1.5 h-4 w-4" /> {connected.length ? "Add another" : "Connect"}
              </Button>
            </div>
            {connected.map((f) => (
              <div key={f.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2">
                <div className="min-w-0">
                  {f.status === "error" ? (
                    <Badge variant="outline" className="border-brand-error/40 text-brand-error-text"><AlertCircle className="mr-1 h-3 w-3" /> Sync error</Badge>
                  ) : (
                    <Badge variant="outline" className="border-brand-success/40 text-brand-success-text"><CheckCircle2 className="mr-1 h-3 w-3" /> Connected</Badge>
                  )}
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {f.error ?? (f.lastSyncedAt ? `Last synced ${new Date(f.lastSyncedAt).toLocaleString()}` : "")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => sync(f)} disabled={busy === f.id}>
                    {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-1.5">Sync</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-brand-error-text hover:text-brand-error-text"><Unlink className="mr-1.5 h-4 w-4" /> Disconnect</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {f.label}?</AlertDialogTitle>
                        <AlertDialogDescription>Momentum will forget the link and its imported events. Nothing in your real calendar changes, and your study sessions stay.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { const save = async () => { try { await commit({ type: "removeFeed", id: f.id }); toast.success("Calendar disconnected"); } catch { toast.error("Couldn't disconnect the calendar — check your connection.", { action: { label: "Retry", onClick: () => void save() } }); } }; void save(); }}>Disconnect</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Calendars connect with a private, read-only calendar link — never your password. Momentum reads your events to find free time; to add study sessions to your calendar, download them as a calendar file. Direct Google/Outlook sign-in with two-way sync needs extra setup by the app owner and isn't switched on yet.
      </p>

      <Dialog open={!!connecting} onOpenChange={(o) => !o && setConnecting(null)}>
        {connecting && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect {PROVIDER_INFO[connecting].name}</DialogTitle>
              <DialogDescription>{PROVIDER_INFO[connecting].steps}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feed-url">Calendar link</Label>
              <Input id="feed-url" placeholder="https://… or webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">Keep this link private — anyone with it can see your calendar.</p>
            </div>
            <DialogFooter>
              <Button onClick={connect} disabled={busy === "new"} className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
                {busy === "new" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Connect calendar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
