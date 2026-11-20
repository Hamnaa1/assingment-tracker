import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, CalendarCheck, CalendarClock, CheckSquare, Clock, History, RefreshCw, Scale, Settings2, Sparkles, Target } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CustomiseDashboard } from "@/components/momentum/CustomiseDashboard";
import { DeadlinePill } from "@/components/momentum/shared";
import { PRESETS, dashboardOf, visibleWidgets, type WidgetId } from "@/lib/momentum/dashboard";
import { STUDY_PERIODS } from "@/lib/momentum/schedule";
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
  const [customising, setCustomising] = useState(false);
  const dash = dashboardOf(state.dashboard);
  const minimal = dash.mode === "minimal";
  // Keep the availability editor in sync when the dashboard dialog changes study habits.
  useEffect(() => setPrefs(prefsOf(state)), [state.availability]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = useMemo(() => rankAssignments(state), [state]);
  const behind = useMemo(() => detectBehind(state), [state]);
  const titleOf = (id: string) => state.assignments.find((a) => a.id === id)?.title ?? "";

  const now = new Date();
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d; });
  const sessionsOn = (d: Date) => (state.studySessions ?? []).filter((s) => toYmd(new Date(s.start)) === toYmd(d)).sort((a, b) => a.start.localeCompare(b.start));
  const eventsOn = (d: Date) => (state.calendarEvents ?? []).filter((e) => !e.allDay && toYmd(new Date(e.start)) === toYmd(d));
  const weekMinutes = week.reduce((s, d) => s + sessionsOn(d).reduce((m, x) => m + (Date.parse(x.end) - Date.parse(x.start)) / 60000, 0), 0);
  const today = toYmd(now);
  const todaySessions = sessionsOn(now);
  const todayTasks = state.tasks.filter((t) => !t.completed && (t.dueDate <= today || todaySessions.some((s) => s.taskId === t.id)));
  const doneToday = state.tasks.filter((t) => t.completed && t.completedAt && toYmd(new Date(t.completedAt)) === today).length;
  const doneCount = state.tasks.filter((t) => t.completed).length;
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const studiedThisWeek = (state.sessions ?? []).filter((f) => Date.parse(f.startedAt) >= weekStart.getTime()).reduce((m, f) => m + f.actualMinutes, 0);
  const upcoming = [...state.assignments].filter((a) => state.tasks.some((t) => t.assignmentId === a.id && !t.completed) || !state.tasks.some((t) => t.assignmentId === a.id)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const remainingOf = (id: string) => state.tasks.filter((t) => t.assignmentId === id && !t.completed).reduce((m, t) => m + t.estimatedMinutes, 0);
  const pctOf = (id: string) => { const ts = state.tasks.filter((t) => t.assignmentId === id); return ts.length ? Math.round((ts.filter((t) => t.completed).length / ts.length) * 100) : 0; };
  const prefsDirty = JSON.stringify(prefs) !== JSON.stringify(prefsOf(state));
  const weightsDirty = JSON.stringify(weights) !== JSON.stringify(weightsOf(state));
  const norm = normaliseWeights(weights);

  const setDay = (d: number, w: SchedulePrefs["days"][number]) => setPrefs({ ...prefs, days: prefs.days.map((x, i) => (i === d ? w : x)) });

  const saveAvailability = () => {
    if (prefs.days.some((w) => w && w.end <= w.start)) return toast.error("Each study window must end after it starts");
    dispatch({ type: "setAvailability", availability: prefs });
    toast.success("Availability saved", { description: "Priorities updated. Reschedule to apply it to your sessions." });
  };


  const widgets: Record<WidgetId, ReactNode> = {
    risk: (<>{behind.length > 0 ? (
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
      )}</>),
    priorities: (<Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-4 w-4 text-brand-lavender" /> Priority ranking</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ranked.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
            {(minimal ? ranked.slice(0, 3) : ranked).map(({ a, p }, i) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/assignments/${a.id}`} className="truncate text-sm font-bold hover:text-brand-lavender">{i + 1}. {a.title}</Link>
                  <Badge variant="outline" className={LEVEL_STYLES[p.level].badge}>{p.score} · {LEVEL_STYLES[p.level].label}</Badge>
                </div>
                {!minimal && <p className="mt-1 text-xs text-muted-foreground">{p.explanation}</p>}
                {!minimal && <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Score breakdown">
                  {(["urgency", "workload", "importance", "difficulty", "risk"] as const).map((k, j) => {
                    const val = k === "difficulty" ? p.difficulty ?? 0 : p[k];
                    return <span key={k} title={`${FACTOR_LABELS[k]}: ${Math.round((val * (p.weights?.[k] ?? 0)) / 100)} pts`} className={cn("h-full", ["bg-brand-lavender", "bg-brand-lilac", "bg-brand-charcoal/60", "bg-brand-warning", "bg-brand-error"][j])} style={{ width: `${(val * (p.weights?.[k] ?? 0)) / 100}%` }} />;
                  })}
                </div>}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Change a deadline, difficulty, weighting or task estimate with “Edit Assignment” and scores update instantly.</p>
          </CardContent>
        </Card>),
    schedule: (<Card className="border-border/80 shadow-sm">
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
                  {(!minimal || i === 0) && list.map((s) => (
                    <p key={s.id} className="mt-1 flex justify-between gap-2 text-xs">
                      <span className="truncate"><span className="font-semibold">{new Date(s.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span> · {s.title} <span className="text-muted-foreground">({titleOf(s.assignmentId)})</span></span>
                      <span className="shrink-0 text-muted-foreground">{Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000)}m</span>
                    </p>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>),
    availability: (<Card className="border-border/80 shadow-sm">
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
        </Card>),
    weights: (<Card className="border-border/80 shadow-sm">
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
        </Card>),
    changes: (<>{(state.scheduleLog ?? []).length > 0 ? (
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
      ) : <Card className="border-border/80 shadow-sm"><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><History className="h-4 w-4 text-brand-lavender" /> No schedule changes yet — they will be explained here after you auto-reschedule.</CardContent></Card>}</>),
    dailyTasks: (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><CheckSquare className="h-4 w-4 text-brand-lavender" /> Today's tasks</CardTitle>
          <p className="text-xs text-muted-foreground">{doneToday} of {dash.goals.dailyTasks} done today · {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"} planned</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {todayTasks.length === 0 && <p className="text-sm text-muted-foreground">Nothing due or scheduled today.</p>}
          {(minimal ? todayTasks.slice(0, 4) : todayTasks).map((t) => {
            const s = todaySessions.find((x) => x.taskId === t.id);
            return (
              <label key={t.id} className="flex items-start gap-3 rounded-md border p-2.5 text-sm">
                <Checkbox checked={t.completed} onCheckedChange={() => dispatch({ type: "toggleTask", id: t.id })} aria-label={`Mark ${t.title} done`} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{titleOf(t.assignmentId)}{s ? ` · ${new Date(s.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}{t.dueDate < today ? " · overdue" : ""} · {t.estimatedMinutes}m</span>
                </span>
              </label>
            );
          })}
        </CardContent>
      </Card>
    ),
    deadlines: (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-4 w-4 text-brand-lavender" /> Upcoming deadlines</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No open assignments.</p>}
          {(minimal ? upcoming.slice(0, 3) : upcoming.slice(0, 6)).map((a) => (
            <div key={a.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/assignments/${a.id}`} className="truncate text-sm font-semibold hover:text-brand-lavender">{a.title}</Link>
                <DeadlinePill deadline={a.deadline} />
              </div>
              {!minimal && <div className="flex items-center gap-2"><Progress value={pctOf(a.id)} className="h-1.5" /><span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{pctOf(a.id)}% · {hours(remainingOf(a.id))} left</span></div>}
            </div>
          ))}
        </CardContent>
      </Card>
    ),
    workload: (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-4 w-4 text-brand-lavender" /> Weekly workload</CardTitle>
          <p className="text-xs text-muted-foreground">{hours(weekMinutes)} planned · goal {dash.goals.weeklyHours}h · daily limit {hours(prefs.maxDailyMinutes)}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex h-36 items-end gap-2" aria-label="Planned study per day">
            {week.map((d, i) => {
              const m = sessionsOn(d).reduce((x, s) => x + (Date.parse(s.end) - Date.parse(s.start)) / 60000, 0);
              const cap = prefsOf(state).days[d.getDay()] ? prefsOf(state).maxDailyMinutes : 0;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{m ? hours(m) : ""}</span>
                  <div className="relative flex h-24 w-full items-end rounded bg-muted" title={`${hours(m)} of ${hours(cap)}`}>
                    <div className={cn("w-full rounded", m > cap ? "bg-brand-error" : "bg-brand-lavender")} style={{ height: `${Math.min(100, cap ? (m / cap) * 100 : m ? 100 : 0)}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold">{i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                </div>
              );
            })}
          </div>
          {!minimal && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-bold">Remaining work by assignment</p>
              {ranked.filter(({ a }) => remainingOf(a.id) > 0).map(({ a }) => {
                const total = state.tasks.filter((t) => !t.completed).reduce((m, t) => m + t.estimatedMinutes, 0) || 1;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate">{a.title}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand-lilac" style={{ width: `${(remainingOf(a.id) / total) * 100}%` }} /></div>
                    <span className="w-10 text-right text-muted-foreground">{hours(remainingOf(a.id))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    progress: (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Target className="h-4 w-4 text-brand-lavender" /> Progress & goals</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            { label: "Planned this week", value: weekMinutes / 60, goal: dash.goals.weeklyHours, unit: "h" },
            { label: "Focus time this week", value: studiedThisWeek / 60, goal: dash.goals.weeklyHours, unit: "h" },
            { label: "Tasks finished today", value: doneToday, goal: dash.goals.dailyTasks, unit: "" },
          ].map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm"><span className="font-semibold">{g.label}</span><span className="text-muted-foreground">{Math.round(g.value * 10) / 10}{g.unit} / {g.goal}{g.unit}</span></div>
              <Progress value={Math.min(100, (g.value / g.goal) * 100)} className="h-2" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{doneCount} of {state.tasks.length} tasks complete overall.{weekMinutes / 60 < dash.goals.weeklyHours ? " Your schedule is below your weekly goal — extend availability or add tasks." : ""}</p>
          {!minimal && state.assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs"><span className="w-40 truncate">{a.title}</span><Progress value={pctOf(a.id)} className="h-1.5" /><span className="w-9 text-right text-muted-foreground">{pctOf(a.id)}%</span></div>
          ))}
        </CardContent>
      </Card>
    ),
  };
  const FULL: WidgetId[] = ["risk", "changes"];
  const shown = visibleWidgets(dash);
  const habitsSummary = `${prefs.maxSessionMinutes}-min sessions · ${prefs.bufferMinutes}-min breaks${prefs.preferredTimes?.length ? ` · prefers ${prefs.preferredTimes.map((p) => STUDY_PERIODS[p].label.split(" ")[0].toLowerCase()).join(", ")}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Study Plan</h1>
          <p className="text-sm text-muted-foreground">Your priorities, availability and a realistic schedule across every assignment.</p>
          <p className="mt-1 text-xs text-muted-foreground"><Badge variant="outline" className="mr-2 border-brand-lavender/40 text-brand-lavender">{dash.preset === "custom" ? "Custom" : PRESETS[dash.preset].label}</Badge>{habitsSummary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setCustomising(true)}><Settings2 className="mr-1.5 h-4 w-4" /> Customise Dashboard</Button>
        <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => setProposal(reschedule(state))}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Auto-reschedule unfinished tasks
        </Button>
        </div>
      </div>
      <CustomiseDashboard open={customising} onOpenChange={setCustomising} />

      <div className="grid gap-6 xl:grid-cols-2">
        {shown.map((id) => <div key={id} className={cn(FULL.includes(id) && "xl:col-span-2")} data-widget={id}>{widgets[id]}</div>)}
      </div>

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
