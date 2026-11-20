import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useMomentum } from "@/lib/momentum/store";
import { useXp } from "@/lib/momentum/social";
import { buckets, focusMinutes, focusSeries, heatmap, sumInto, taskSeries, type Range } from "@/lib/momentum/analytics";
import { dashboardOf } from "@/lib/momentum/dashboard";
import { toYmd } from "@/lib/momentum/engine";
import { ProgressRing, useCssVar } from "./visual";
import { cn } from "@/lib/utils";

type Metric = "focus" | "xp" | "tasks" | "consistency" | "goals" | "assignments";
const METRICS: { id: Metric; label: string }[] = [
  { id: "focus", label: "Focus" }, { id: "xp", label: "XP" }, { id: "tasks", label: "Tasks" },
  { id: "consistency", label: "Streak" }, { id: "goals", label: "Goals" }, { id: "assignments", label: "Workload" },
];

function Empty({ text }: { text: string }) {
  return <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm text-muted-foreground"><BarChart3 className="h-6 w-6 text-brand-lavender" />{text}</div>;
}

/** One interactive chart with selectable metrics, built only from the student's real activity. */
export function Analytics() {
  const { state } = useMomentum();
  const { txs } = useXp();
  const [metric, setMetric] = useState<Metric>("focus");
  const [range, setRange] = useState<Range>("day");
  const primary = useCssVar("--brand-lavender", "#7a52bf");
  const lilac = useCssVar("--brand-lilac", "#c3aef0");
  const dash = dashboardOf(state.dashboard);
  const bs = useMemo(() => buckets(range), [range]);

  const series = useMemo(() => {
    if (metric === "focus") return focusSeries(bs, state.sessions);
    if (metric === "tasks") return taskSeries(bs, state.tasks);
    if (metric === "xp") return sumInto(bs, txs, (t) => t.activity_at, (t) => t.amount);
    return [];
  }, [metric, bs, state.sessions, state.tasks, txs]);
  const hasData = series.some((p) => p.value > 0);
  const unit = metric === "focus" ? "min" : metric === "xp" ? "XP" : "tasks";

  const today = toYmd(new Date());
  const doneToday = state.tasks.filter((t) => t.completed && t.completedAt && toYmd(new Date(t.completedAt)) === today).length;
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekFocus = state.sessions.filter((s) => Date.parse(s.endedAt) >= weekStart.getTime()).reduce((m, s) => m + focusMinutes(s), 0);

  const workload = state.assignments
    .map((a) => ({ name: a.title, value: state.tasks.filter((t) => t.assignmentId === a.id && !t.completed).reduce((m, t) => m + t.estimatedMinutes, 0) }))
    .filter((x) => x.value > 0);
  const palette = [primary, lilac, "#242330", "#c98a1a", "#2f8f63", "#d65a5a"];
  const days = useMemo(() => heatmap(state.sessions, state.tasks), [state.sessions, state.tasks]);
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Your productivity</CardTitle>
          {["focus", "xp", "tasks"].includes(metric) && (
            <div className="flex gap-1" role="group" aria-label="Time range">
              {(["day", "week", "month"] as Range[]).map((r) => (
                <Button key={r} size="sm" variant={range === r ? "default" : "ghost"} aria-pressed={range === r} className={cn("h-7 px-2.5 text-xs", range === r && "bg-brand-lavender text-white hover:bg-brand-lavender/90")} onClick={() => setRange(r)}>
                  {r === "day" ? "Daily" : r === "week" ? "Weekly" : "Monthly"}
                </Button>
              ))}
            </div>
          )}
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {METRICS.map((m) => <TabsTrigger key={m.id} value={m.id} className="text-xs">{m.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {["focus", "xp", "tasks"].includes(metric) && (hasData ? (
          <div className="h-56" role="img" aria-label={`${METRICS.find((m) => m.id === metric)!.label} per ${range}: ${series.map((p) => `${p.label} ${p.value} ${unit}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              {metric === "xp" ? (
                <LineChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip formatter={(v: number) => [`${v} ${unit}`, "XP"]} />
                  <Line type="monotone" dataKey="value" stroke={primary} strokeWidth={3} dot={{ r: 3, fill: primary }} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip formatter={(v: number) => [`${v} ${unit}`, metric === "focus" ? "Focus" : "Completed"]} cursor={{ fill: lilac, opacity: 0.3 }} />
                  <Bar dataKey="value" fill={primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : <Empty text={metric === "xp" ? "Earn XP by finishing focus sessions and tasks." : metric === "focus" ? "Lock in for a focus session to see your focus time here." : "Tick off a task to start your chart."} />)}

        {metric === "consistency" && (days.some((d) => d.count) ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto" role="grid" aria-label="Study consistency, last 12 weeks">
              {days.map((d) => (
                <div key={d.date.toISOString()} role="gridcell" tabIndex={0} title={`${d.date.toLocaleDateString()}: ${d.count} activit${d.count === 1 ? "y" : "ies"}`} aria-label={`${d.date.toLocaleDateString()}: ${d.count} activities`}
                  className="h-4 w-4 rounded-sm border border-border/50" style={{ backgroundColor: d.count ? primary : undefined, opacity: d.count ? 0.3 + 0.7 * (d.count / max) : 1 }} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Each square is a day. Darker = more focus sessions and tasks. Rest days are part of the plan.</p>
          </div>
        ) : <Empty text="Your study days will light up here." />)}

        {metric === "goals" && (
          <div className="flex flex-wrap items-center justify-around gap-6 py-2">
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={(doneToday / dash.goals.dailyTasks) * 100} size={120} label="Daily task goal"><span className="text-xl font-extrabold">{doneToday}/{dash.goals.dailyTasks}</span><span className="text-[10px] text-muted-foreground">tasks today</span></ProgressRing>
              <p className="text-xs font-semibold">Daily goal</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={(weekFocus / (dash.goals.weeklyHours * 60)) * 100} size={120} label="Weekly focus goal"><span className="text-xl font-extrabold">{Math.round((weekFocus / 60) * 10) / 10}h</span><span className="text-[10px] text-muted-foreground">of {dash.goals.weeklyHours}h</span></ProgressRing>
              <p className="text-xs font-semibold">Weekly focus</p>
            </div>
          </div>
        )}

        {metric === "assignments" && (workload.length ? (
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div className="h-48" role="img" aria-label={`Remaining work: ${workload.map((w) => `${w.name} ${Math.round(w.value / 60)}h`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={workload} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {workload.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v: number) => `${Math.round((v / 60) * 10) / 10}h left`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-col gap-2 text-xs">
              {workload.map((w, i) => (
                <li key={w.name} className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} /><span className="flex-1 truncate">{w.name}</span><span className="font-bold">{Math.round((w.value / 60) * 10) / 10}h</span></li>
              ))}
            </ul>
          </div>
        ) : <Empty text="No remaining work — add an assignment to see your workload." />)}
      </CardContent>
    </Card>
  );
}
