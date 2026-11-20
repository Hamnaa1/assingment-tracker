import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarCheck, Clock, History, RefreshCw, Scale, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useMomentum } from "@/lib/momentum/store";
import { detectBehind, hours, prefsOf, rankAssignments, reschedule, toYmd, weightsOf, type RescheduleResult } from "@/lib/momentum/engine";
import { DEFAULT_WEIGHTS, FACTOR_LABELS, LEVEL_STYLES, normaliseWeights, type PriorityWeights } from "@/lib/momentum/priority";
import { DEFAULT_PREFS, type SchedulePrefs } from "@/lib/momentum/schedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toTime = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const fromTime = (t: string) => { const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; };

export default function StudyPlan() {
  const { state, dispatch } = useMomentum();
  const [prefs, setPrefs] = useState<SchedulePrefs>(prefsOf(state));
  const [weights, setWeights] = useState<PriorityWeights>(weightsOf(state));
  const [proposal, setProposal] = useState<RescheduleResult | null>(null);

  const ranked = useMemo(() => rankAssignments(state), [state]);
  const behind = useMemo(() => detectBehind(state), [state]);
  const titleOf = (id: string) => state.assignments.find((a) => a.id === id)?.title ?? "";

  const now = new Date();
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
  const sessionsOn = (d: Date) => (state.studySessions ?? []).filter((s) => toYmd(new Date(s.start)) === toYmd(d)).sort((a, b) => a.start.localeCompare(b.start));
  const eventsOn = (d: Date) => (state.calendarEvents ?? []).filter((e) => !e.allDay && toYmd(new Date(e.start)) === toYmd(d));
  const weekMinutes = week.reduce((s, d) => s + sessionsOn(d).reduce((m, x) => m + (Date.parse(x.end) - Date.parse(x.start)) / 60000, 0), 0);
  const prefsDirty = JSON.stringify(prefs) !== JSON.stringify(prefsOf(state));
  const weightsDirty = JSON.stringify(weights) !== JSON.stringify(weightsOf(state));
  const norm = normaliseWeights(weights);

  const setDay = (d: number, w: SchedulePrefs["days"][number]) => setPrefs({ ...prefs, days: prefs.days.map((x, i) => (i === d ? w : x)) });

  const saveAvailability = () => {
    if (prefs.days.some((w) => w && w.end <= w.start)) return toast.error("Each study window must end after it starts");
    dispatch({ type: "setAvailability", availability: prefs });
    toast.success("Availability saved", { description: "Priorities updated. Reschedule to apply it to your sessions." });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Study Plan</h1>
          <p className="text-sm text-muted-foreground">Your priorities, availability and a realistic schedule across every assignment.</p>
        </div>
        <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => setProposal(reschedule(state))}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Auto-reschedule unfinished tasks
        </Button>
      </div>

      {behind.length > 0 ? (
        <Card className="border-brand-warning/40 bg-brand-warning/10 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4 text-brand-warning" /> You're falling behind on {behind.length} assignment{behind.length > 1 ? "s" : ""}</p>
            {behind.map((b) => (
              <div key={b.assignmentId} className="text-sm">
                <Link to={`/assignments/${b.assignmentId}`} className="font-semibold underline-offset-2 hover:underline">{b.title}</Link>
                <ul className="ml-4 list-disc text-xs text-foreground/80">{b.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Auto-reschedule moves unfinished work into your next free study time, highest priority first.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-brand-success/30 bg-brand-success/5 shadow-sm">
          <CardContent className="flex items-center gap-2 p-4 text-sm"><CalendarCheck className="h-4 w-4 text-brand-success" /> You're on track — no overdue tasks, missed sessions or time shortfalls.</CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Priorities */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-4 w-4 text-brand-lavender" /> Priority ranking</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ranked.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
            {ranked.map(({ a, p }, i) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/assignments/${a.id}`} className="truncate text-sm font-bold hover:text-brand-lavender">{i + 1}. {a.title}</Link>
                  <Badge variant="outline" className={LEVEL_STYLES[p.level].badge}>{p.score} · {LEVEL_STYLES[p.level].label}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.explanation}</p>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Score breakdown">
                  {(["urgency", "workload", "importance", "difficulty", "risk"] as const).map((k, j) => {
                    const val = k === "difficulty" ? p.difficulty ?? 0 : p[k];
                    return <span key={k} title={`${FACTOR_LABELS[k]}: ${Math.round((val * (p.weights?.[k] ?? 0)) / 100)} pts`} className={cn("h-full", ["bg-brand-lavender", "bg-brand-lilac", "bg-brand-charcoal/60", "bg-brand-warning", "bg-brand-error"][j])} style={{ width: `${(val * (p.weights?.[k] ?? 0)) / 100}%` }} />;
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Change a deadline, difficulty, weighting or task estimate with “Edit Assignment” and scores update instantly.</p>
          </CardContent>
        </Card>

        {/* Week schedule */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-4 w-4 text-brand-lavender" /> Next 7 days</CardTitle>
            <p className="text-xs text-muted-foreground">{hours(weekMinutes)} of study planned this week.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {week.map((d, i) => {
              const list = sessionsOn(d);
              const ev = eventsOn(d);
              return (
                <div key={i} className={cn("rounded-lg border p-2.5", i === 0 && "border-brand-lavender/50 bg-brand-soft-purple/30")}>
                  <p className="text-xs font-bold">{i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                    <span className="ml-2 font-normal text-muted-foreground">{list.length ? `${list.length} session${list.length > 1 ? "s" : ""}` : "No study planned"}{ev.length ? ` · ${ev.length} calendar event${ev.length > 1 ? "s" : ""}` : ""}</span>
                  </p>
                  {list.map((s) => (
                    <p key={s.id} className="mt-1 flex justify-between gap-2 text-xs">
                      <span className="truncate"><span className="font-semibold">{new Date(s.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span> · {s.title} <span className="text-muted-foreground">({titleOf(s.assignmentId)})</span></span>
                      <span className="shrink-0 text-muted-foreground">{Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000)}m</span>
                    </p>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Availability */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Daily study availability</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ORDER.map((d) => {
              const w = prefs.days[d];
              return (
                <div key={d} className="flex flex-wrap items-center gap-3">
                  <Switch checked={!!w} onCheckedChange={(on) => setDay(d, on ? { start: 9, end: 17 } : null)} aria-label={`Study on ${DAY_NAMES[d]}`} />
                  <span className="w-24 text-sm font-semibold">{DAY_NAMES[d]}</span>
                  {w ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" className="w-28" aria-label={`${DAY_NAMES[d]} start`} value={toTime(w.start)} onChange={(e) => e.target.value && setDay(d, { ...w, start: fromTime(e.target.value) })} />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" className="w-28" aria-label={`${DAY_NAMES[d]} end`} value={toTime(w.end)} onChange={(e) => e.target.value && setDay(d, { ...w, end: fromTime(e.target.value) })} />
                    </div>
                  ) : <span className="text-xs text-muted-foreground">Day off</span>}
                </div>
              );
            })}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col gap-1.5"><Label htmlFor="max-day">Max hours/day</Label><Input id="max-day" type="number" min={0.5} step={0.5} value={prefs.maxDailyMinutes / 60} onChange={(e) => setPrefs({ ...prefs, maxDailyMinutes: Math.max(30, Math.round((parseFloat(e.target.value) || 0) * 60)) })} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="max-sit">Longest sitting (min)</Label><Input id="max-sit" type="number" min={15} step={15} value={prefs.maxSessionMinutes} onChange={(e) => setPrefs({ ...prefs, maxSessionMinutes: Math.max(15, parseInt(e.target.value) || 0) })} /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="buf">Break (min)</Label><Input id="buf" type="number" min={0} step={5} value={prefs.bufferMinutes} onChange={(e) => setPrefs({ ...prefs, bufferMinutes: Math.max(0, parseInt(e.target.value) || 0) })} /></div>
            </div>
            <div className="flex gap-2">
              <Button disabled={!prefsDirty} className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={saveAvailability}>Save availability</Button>
              <Button variant="ghost" onClick={() => setPrefs(DEFAULT_PREFS)}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Weights */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-4 w-4 text-brand-lavender" /> What matters most to you</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(Object.keys(FACTOR_LABELS) as (keyof PriorityWeights)[]).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span className="font-semibold">{FACTOR_LABELS[k]}</span><span className="text-muted-foreground">{Math.round(norm[k])}%</span></div>
                <Slider aria-label={FACTOR_LABELS[k]} min={0} max={50} step={1} value={[weights[k]]} onValueChange={([v]) => setWeights({ ...weights, [k]: v })} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Weights are rescaled to total 100%. Defaults: urgency 35, workload 20, weighting 20, difficulty 10, risk 15.</p>
            <div className="flex gap-2">
              <Button disabled={!weightsDirty} className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => { dispatch({ type: "setWeights", weights }); toast.success("Priority weights saved"); }}>Save weights</Button>
              <Button variant="ghost" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {(state.scheduleLog ?? []).length > 0 && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><History className="h-4 w-4 text-brand-lavender" /> Why your schedule changed</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(state.scheduleLog ?? []).slice(0, 3).map((l) => (
              <div key={l.at} className="text-sm">
                <p className="font-semibold">{new Date(l.at).toLocaleString()} — {l.summary}</p>
                <ul className="ml-4 list-disc text-xs text-muted-foreground">{l.changes.slice(0, 12).map((c, i) => <li key={i}>{c}</li>)}{l.changes.length > 12 && <li>…and {l.changes.length - 12} more</li>}</ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!proposal} onOpenChange={(o) => !o && setProposal(null)}>
        {proposal && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reschedule unfinished work?</DialogTitle>
              <DialogDescription>{proposal.log.summary} Completed tasks and past finished sessions stay as they are. Your real calendar is never changed.</DialogDescription>
            </DialogHeader>
            <ul className="ml-4 list-disc text-sm">{proposal.log.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setProposal(null)}>Cancel</Button>
              <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => {
                dispatch({ type: "applyReschedule", sessions: proposal.sessions, removeIds: proposal.removeIds, taskUpdates: proposal.taskUpdates, log: proposal.log });
                toast.success("Schedule updated", { description: `${proposal.sessions.length} sessions planned.` });
                setProposal(null);
              }}>Apply new schedule</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
