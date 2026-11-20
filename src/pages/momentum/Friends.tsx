import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Ban, Check, Copy, Crown, Flame, Minus, Search, Swords, Trophy, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useXp, type Profile } from "@/lib/momentum/social";
import { useLeaderboard } from "@/lib/momentum/useLeaderboard";
import { levelFor, type BoardMetric, type BoardPeriod } from "@/lib/momentum/xp";
import { AchievementGrid, XpCard } from "@/components/momentum/visual";
import { cn } from "@/lib/utils";

const AVATARS = ["🎓", "📚", "🚀", "🌱", "🦊", "🐼", "🌙", "⚡", "🎧", "🧠"];
interface Conn { id: string | null; other: string; username: string; display_name: string; avatar: string; status: string; incoming: boolean; kind: string }
interface Challenge { id: string; kind: string; target: number; status: string; ends_at: string; incoming: boolean; other_name: string; other_avatar: string; my_progress: number; their_progress: number }
const CHALLENGE_KINDS: Record<string, { label: string; unit: string; suggest: number; days: number }> = {
  focus_sessions: { label: "Focus sessions", unit: "sessions", suggest: 3, days: 1 },
  xp: { label: "Earn XP", unit: "XP", suggest: 500, days: 7 },
  tasks: { label: "Complete tasks", unit: "tasks", suggest: 5, days: 7 },
  goal_days: { label: "Meet daily goal", unit: "days", suggest: 3, days: 3 },
};
const METRICS: { id: BoardMetric; label: string; unit: string }[] = [
  { id: "xp", label: "XP", unit: "XP" }, { id: "focus", label: "Focus", unit: "min" }, { id: "tasks", label: "Tasks", unit: "tasks" }, { id: "consistency", label: "Goal consistency", unit: "%" },
];
const err = (e: { message: string } | null) => { if (e) toast.error(e.message); return !e; };

export function Podium({ rows, unit }: { rows: { user_id: string; display_name: string; avatar: string; value: number; is_me: boolean }[]; unit: string }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-16", "h-24", "h-12"], medals = ["🥈", "🥇", "🥉"], tones = ["bg-muted", "bg-brand-lavender text-white", "bg-brand-soft-purple"];
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4" aria-label="Top three">
      {order.map((r, i) => r ? (
        <div key={r.user_id} className="flex w-24 flex-col items-center gap-1 text-center">
          <span className="text-3xl" aria-hidden>{r.avatar}</span>
          <span className={cn("max-w-full truncate text-xs font-bold", r.is_me && "text-brand-lavender")}>{r.is_me ? "You" : r.display_name}</span>
          <span className="text-[11px] text-muted-foreground">{r.value} {unit}</span>
          <div className={cn("flex w-full items-start justify-center rounded-t-xl pt-1 text-xl", heights[i], tones[i])}><span aria-label={["Silver", "Gold", "Bronze"][i]}>{medals[i]}</span></div>
        </div>
      ) : <div key={i} className="w-24" />)}
    </div>
  );
}

export default function Friends() {
  const { profile, setProfile, totalXp } = useXp();
  const [form, setForm] = useState<Profile | null>(profile);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ user_id: string; username: string; display_name: string; avatar: string } | null | "none">(null);
  const [conns, setConns] = useState<Conn[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [metric, setMetric] = useState<BoardMetric>("xp");
  const [newCh, setNewCh] = useState<{ friend: string; kind: string; target: number }>({ friend: "", kind: "focus_sessions", target: 3 });
  const board = useLeaderboard(period, metric);

  useEffect(() => setForm(profile), [profile]);
  const loadConns = async () => {
    const [{ data: c }, { data: ch }] = await Promise.all([supabase.rpc("list_connections"), supabase.rpc("my_challenges")]);
    setConns((c ?? []) as Conn[]);
    setChallenges((ch ?? []) as Challenge[]);
  };
  useEffect(() => { loadConns(); }, [totalXp]);
  const refreshAll = () => { loadConns(); board.reload(); };

  const friends = conns.filter((c) => c.kind === "friendship" && c.status === "accepted");
  const incoming = conns.filter((c) => c.status === "pending" && c.incoming);
  const outgoing = conns.filter((c) => c.status === "pending" && !c.incoming);
  const blocked = conns.filter((c) => c.kind === "block");

  const saveProfile = async () => {
    if (!form) return;
    const { data, error } = await supabase.rpc("update_my_profile", { p_username: form.username, p_display_name: form.display_name, p_avatar: form.avatar, p_opt_in: form.leaderboard_opt_in, p_share_focus: form.share_focus, p_share_streak: form.share_streak });
    if (err(error) && data) { setProfile(data as Profile); toast.success("Profile saved"); board.reload(); }
  };
  const search = async () => {
    if (!query.trim()) return;
    const { data, error } = await supabase.rpc("find_student", { p_query: query });
    if (err(error)) setFound(data?.[0] ?? "none");
  };
  const add = async (id: string) => {
    const { data, error } = await supabase.rpc("send_friend_request", { p_target: id });
    if (!err(error)) return;
    toast.success({ sent: "Friend request sent", accepted: "You're now friends!", already_sent: "Request already sent", already_friends: "You're already friends" }[data as string] ?? "Done");
    setFound(null); setQuery(""); refreshAll();
  };
  const call = async (fn: () => PromiseLike<{ error: { message: string } | null }>, msg: string) => { const { error } = await fn(); if (err(error)) { toast.success(msg); refreshAll(); } };
  const unit = METRICS.find((m) => m.id === metric)!.unit;
  const me = board.rows.find((r) => r.is_me);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Friends</h1>
        <p className="text-sm text-muted-foreground">Lock in together. Only totals you allow are shared.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5 text-brand-lavender" /> Leaderboard</CardTitle>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as BoardPeriod)}>
                  <TabsList><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="month">Month</TabsTrigger><TabsTrigger value="all">All time</TabsTrigger></TabsList>
                </Tabs>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
                {METRICS.map((m) => <Button key={m.id} size="sm" variant="outline" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)} className={cn("h-8 text-xs", metric === m.id && "border-brand-lavender bg-brand-soft-purple")}>{m.label}</Button>)}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!profile?.leaderboard_opt_in && <p className="rounded-lg bg-muted p-2.5 text-xs">You've opted out — friends can't see you. Turn it back on in your profile.</p>}
              {board.rows.length > 1 ? <Podium rows={board.rows} unit={unit} /> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Add friends to start competing. {metric === "consistency" && "Consistency compares how often you each hit your own goal — fair for every timetable."}</p>}
              <ol className="flex flex-col gap-1.5">
                {board.rows.map((r) => (
                  <li key={r.user_id} className={cn("flex items-center gap-3 rounded-xl border p-2.5", r.is_me && "border-brand-lavender bg-brand-soft-purple/60")}>
                    <span className="w-6 text-center text-sm font-extrabold">{r.rank}</span>
                    <span className="text-2xl" aria-hidden>{r.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{r.is_me ? `${r.display_name} (you)` : r.display_name}</p>
                      <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>Lv {levelFor(Number(r.total_xp)).level}</span>
                        <span>{r.period_xp} XP</span>
                        {r.focus_minutes !== null && <span>{r.focus_minutes} min focus</span>}
                        {r.streak !== null && <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3" />{r.streak}d</span>}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold">{r.value}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span></span>
                    <span className="w-6" aria-label={r.change === null ? "New" : r.change > 0 ? `Up ${r.change}` : r.change < 0 ? `Down ${-r.change}` : "No change"}>
                      {r.change === null || r.change === 0 ? <Minus className="h-4 w-4 text-muted-foreground" /> : r.change > 0 ? <ArrowUp className="h-4 w-4 text-brand-success-text" /> : <ArrowDown className="h-4 w-4 text-brand-error-text" />}
                    </span>
                  </li>
                ))}
              </ol>
              {me && <p className="text-center text-xs text-muted-foreground">You're #{me.rank} of {board.rows.length}. Rest days never cost you points.</p>}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Swords className="h-5 w-5 text-brand-lavender" /> Challenges</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {friends.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3">
                  <div className="flex min-w-36 flex-1 flex-col gap-1"><Label className="text-xs">Friend</Label>
                    <Select value={newCh.friend} onValueChange={(v) => setNewCh({ ...newCh, friend: v })}><SelectTrigger className="h-9"><SelectValue placeholder="Choose" /></SelectTrigger>
                      <SelectContent>{friends.map((f) => <SelectItem key={f.other} value={f.other}>{f.avatar} {f.display_name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="flex min-w-36 flex-1 flex-col gap-1"><Label className="text-xs">Challenge</Label>
                    <Select value={newCh.kind} onValueChange={(v) => setNewCh({ ...newCh, kind: v, target: CHALLENGE_KINDS[v].suggest })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CHALLENGE_KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} · {v.days === 1 ? "today" : `${v.days} days`}</SelectItem>)}</SelectContent></Select></div>
                  <div className="flex w-24 flex-col gap-1"><Label className="text-xs" htmlFor="ch-target">Target</Label><Input id="ch-target" className="h-9" type="number" min={1} value={newCh.target} onChange={(e) => setNewCh({ ...newCh, target: parseInt(e.target.value) || 1 })} /></div>
                  <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" disabled={!newCh.friend}
                    onClick={() => call(() => supabase.rpc("create_challenge", { p_opponent: newCh.friend, p_kind: newCh.kind, p_target: newCh.target, p_days: CHALLENGE_KINDS[newCh.kind].days }), "Challenge sent")}>Send</Button>
                </div>
              ) : <p className="text-sm text-muted-foreground">Add a friend to send a friendly challenge.</p>}
              {challenges.map((c) => {
                const k = CHALLENGE_KINDS[c.kind];
                return (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{c.other_avatar} {k.label}: {c.target} {k.unit} <span className="font-normal text-muted-foreground">with {c.other_name}</span></p>
                      {c.status === "pending" && (c.incoming ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => call(() => supabase.rpc("respond_challenge", { p_id: c.id, p_accept: false }), "Challenge declined")}>Decline</Button>
                          <Button size="sm" className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => call(() => supabase.rpc("respond_challenge", { p_id: c.id, p_accept: true }), "Challenge accepted")}>Accept</Button>
                        </div>
                      ) : <Badge variant="outline">Waiting</Badge>)}
                    </div>
                    {c.status === "accepted" && (
                      <div className="mt-2 grid gap-1.5 text-xs">
                        {[["You", c.my_progress], [c.other_name, c.their_progress]].map(([n, v]) => (
                          <div key={n as string} className="flex items-center gap-2"><span className="w-20 truncate">{n}</span><Progress value={Math.min(100, (Number(v) / c.target) * 100)} className="h-2" /><span className="w-16 text-right">{v}/{c.target}</span></div>
                        ))}
                        <p className="text-muted-foreground">Ends {new Date(c.ends_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg">Achievements</CardTitle></CardHeader>
            <CardContent><AchievementGrid /></CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <XpCard />
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-brand-lavender" /> Add a friend</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {profile && (
                <button type="button" className="flex items-center justify-between rounded-xl bg-brand-soft-purple p-3 text-left" onClick={() => { navigator.clipboard?.writeText(profile.friend_code); toast.success("Friend code copied"); }}>
                  <span><span className="block text-[11px] text-muted-foreground">Your friend code</span><span className="font-mono text-lg font-extrabold tracking-widest">{profile.friend_code}</span></span>
                  <Copy className="h-4 w-4" aria-label="Copy friend code" />
                </button>
              )}
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
                <Input aria-label="Username or friend code" placeholder="Username or code" value={query} onChange={(e) => { setQuery(e.target.value); setFound(null); }} />
                <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search className="h-4 w-4" /></Button>
              </form>
              {found === "none" && <p className="text-xs text-muted-foreground">No student found with that exact username or code.</p>}
              {found && found !== "none" && (
                <div className="flex items-center gap-2 rounded-xl border p-2.5">
                  <span className="text-2xl">{found.avatar}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{found.display_name}</span><span className="text-xs text-muted-foreground">@{found.username}</span></span>
                  <Button size="sm" className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => add(found.user_id)}>Add</Button>
                </div>
              )}
              {incoming.length > 0 && <p className="pt-1 text-xs font-bold">Requests for you</p>}
              {incoming.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                  <span className="text-xl">{c.avatar}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.display_name}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Decline ${c.display_name}`} onClick={() => call(() => supabase.rpc("respond_friend_request", { p_id: c.id!, p_accept: false }), "Request declined")}><X className="h-4 w-4" /></Button>
                  <Button size="icon" className="h-8 w-8 bg-brand-lavender text-white hover:bg-brand-lavender/90" aria-label={`Accept ${c.display_name}`} onClick={() => call(() => supabase.rpc("respond_friend_request", { p_id: c.id!, p_accept: true }), "You're now friends!")}><Check className="h-4 w-4" /></Button>
                </div>
              ))}
              {outgoing.length > 0 && <p className="pt-1 text-xs font-bold">Sent</p>}
              {outgoing.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border p-2.5 text-sm"><span className="text-xl">{c.avatar}</span><span className="flex-1 truncate">{c.display_name}</span><Badge variant="outline">Pending</Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Cancel request to ${c.display_name}`} onClick={() => call(() => supabase.rpc("remove_friend", { p_other: c.other }), "Request cancelled")}><X className="h-4 w-4" /></Button></div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-lg">Friends ({friends.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {friends.length === 0 && <p className="text-sm text-muted-foreground">No friends yet.</p>}
              {friends.map((f) => (
                <div key={f.other} className="flex items-center gap-2 rounded-xl border p-2">
                  <span className="text-xl">{f.avatar}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{f.display_name}</span><span className="text-[11px] text-muted-foreground">@{f.username}</span></span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove ${f.display_name}`} onClick={() => call(() => supabase.rpc("remove_friend", { p_other: f.other }), "Friend removed")}><UserMinus className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Block ${f.display_name}`} onClick={() => call(() => supabase.rpc("block_user", { p_other: f.other }), "Blocked")}><Ban className="h-4 w-4" /></Button>
                </div>
              ))}
              {blocked.map((b) => (
                <div key={b.other} className="flex items-center gap-2 rounded-xl border border-dashed p-2 text-sm text-muted-foreground"><Ban className="h-4 w-4" /><span className="flex-1 truncate">{b.display_name}</span>
                  <Button size="sm" variant="ghost" onClick={() => call(() => supabase.rpc("unblock_user", { p_other: b.other }), "Unblocked")}>Unblock</Button></div>
              ))}
            </CardContent>
          </Card>

          {form && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Crown className="h-5 w-5 text-brand-lavender" /> Profile & privacy</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar">
                  {AVATARS.map((a) => <button key={a} type="button" role="radio" aria-checked={form.avatar === a} aria-label={`Avatar ${a}`} onClick={() => setForm({ ...form, avatar: a })} className={cn("h-9 w-9 rounded-lg border text-lg", form.avatar === a && "border-2 border-brand-lavender bg-brand-soft-purple")}>{a}</button>)}
                </div>
                <div className="flex flex-col gap-1"><Label htmlFor="pf-name">Display name</Label><Input id="pf-name" maxLength={40} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="pf-user">Username</Label><Input id="pf-user" maxLength={20} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} /></div>
                {([["leaderboard_opt_in", "Show me on friends' leaderboards"], ["share_focus", "Share my focus minutes"], ["share_streak", "Share my streak"]] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-sm"><span>{l}</span><Switch checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} aria-label={l} /></label>
                ))}
                <p className="text-[11px] text-muted-foreground">Friends never see your email, briefs, grades, calendar or schedule.</p>
                <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={saveProfile}>Save profile</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
