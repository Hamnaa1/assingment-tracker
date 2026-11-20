import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Bell, Brush, Calendar, Check, Clock, Eye, LayoutGrid, RotateCcw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMomentum } from "@/lib/momentum/store";
import { prefsOf } from "@/lib/momentum/engine";
import {
  DEFAULT_ACCESSIBILITY, DEFAULT_DASHBOARD, DEFAULT_NOTIFICATIONS, DEFAULT_THEME, HOME_WIDGETS, PRESETS, THEMES, WIDGETS,
  applyPreset, dashboardOf, habitsOf, moveWidget, themeOf, visibleHomeWidgets, withHabits,
  type ColourTheme, type DashboardPreset, type DashboardPrefs, type Habits, type HomeWidgetId, type WidgetId,
} from "@/lib/momentum/dashboard";
import { DEFAULT_PREFS, STUDY_PERIODS, type SchedulePrefs, type StudyPeriod } from "@/lib/momentum/schedule";
import { FOCUS_SUPPORT, SMALL_TASK_MAX_MINUTES, defaultAnswers, type OnboardingAnswers } from "@/lib/momentum/onboarding";
import { usePlanCommit } from "./PlanUpdate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toTime = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const fromTime = (t: string) => { const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; };

export type PersonaliseTab = "look" | "widgets" | "study" | "availability" | "goals" | "access";

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3>{action}</div>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function WidgetList<T extends string>({ order, hidden, labels, onChange }: { order: T[]; hidden: T[]; labels: Record<T, { label: string }>; onChange: (order: T[], hidden: T[]) => void }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {order.map((id, i) => (
        <li key={id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch checked={!hidden.includes(id)} aria-label={`Show ${labels[id].label}`} onCheckedChange={(on) => onChange(order, on ? hidden.filter((w) => w !== id) : [...hidden, id])} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{labels[id].label}</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} aria-label={`Move ${labels[id].label} up`} onClick={() => onChange(moveWidget(order, id, -1), hidden)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === order.length - 1} aria-label={`Move ${labels[id].label} down`} onClick={() => onChange(moveWidget(order, id, 1), hidden)}><ArrowDown className="h-4 w-4" /></Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Personalise My Dashboard": quick-edit any preference without retaking onboarding.
 * Everything is pre-filled from the student's saved settings; study changes
 * re-plan the future Study Plan automatically on save.
 */
export function CustomiseDashboard({ open, onOpenChange, initialTab = "look" }: { open: boolean; onOpenChange: (o: boolean) => void; initialTab?: PersonaliseTab }) {
  const { state } = useMomentum();
  const { commit, dialog } = usePlanCommit();
  const [tab, setTab] = useState<PersonaliseTab>(initialTab);
  const [dash, setDash] = useState<DashboardPrefs>(dashboardOf(state.dashboard));
  const [habits, setHabits] = useState<Habits>(habitsOf(prefsOf(state)));
  const [avail, setAvail] = useState<SchedulePrefs>(prefsOf(state));
  const [ans, setAns] = useState<OnboardingAnswers>(state.onboarding?.answers ?? defaultAnswers(state.dashboard, prefsOf(state)));
  const savedTheme = themeOf(state.dashboard);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setDash(dashboardOf(state.dashboard));
    setHabits(habitsOf(prefsOf(state)));
    setAvail(prefsOf(state));
    setAns(state.onboarding?.answers ?? defaultAnswers(state.dashboard, prefsOf(state)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live theme preview; reverts to the saved theme if the student cancels.
  useEffect(() => {
    if (open) document.documentElement.dataset.theme = themeOf(dash);
    else document.documentElement.dataset.theme = themeOf(state.dashboard);
  }, [open, dash.theme, state.dashboard]); // eslint-disable-line react-hooks/exhaustive-deps

  const custom = (d: DashboardPrefs) => setDash({ ...d, preset: "custom" });
  const pickPreset = (p: DashboardPreset) => { const r = applyPreset(dash, p); setDash(r.dashboard); setHabits({ ...habits, ...r.habits }); };
  const togglePeriod = (p: StudyPeriod) => setHabits({ ...habits, preferredTimes: habits.preferredTimes.includes(p) ? habits.preferredTimes.filter((x) => x !== p) : [...habits.preferredTimes, p] });
  const setDay = (d: number, w: SchedulePrefs["days"][number]) => setAvail({ ...avail, days: avail.days.map((x, i) => (i === d ? w : x)) });
  const a11y = dash.accessibility ?? DEFAULT_ACCESSIBILITY;
  const notif = dash.notifications ?? DEFAULT_NOTIFICATIONS;

  const close = () => { document.documentElement.dataset.theme = savedTheme; onOpenChange(false); };

  const save = () => {
    if (dash.hidden.length === dash.order.length) return toast.error("Keep at least one Study Plan widget");
    if (avail.days.some((w) => w && w.end <= w.start)) return toast.error("Each study window must end after it starts");
    const sessionMinutes = ans.taskStyle === "small" ? Math.min(habits.sessionMinutes, SMALL_TASK_MAX_MINUTES) : habits.sessionMinutes;
    const availability = withHabits({ ...avail }, { ...habits, sessionMinutes });
    const onboarding = { ...(state.onboarding ?? { status: "skipped" as const, at: new Date().toISOString() }), answers: { ...ans, theme: themeOf(dash), sessionMinutes, breakMinutes: habits.breakMinutes, preferredTimes: habits.preferredTimes, days: avail.days, dailyHours: avail.maxDailyMinutes / 60, weeklyHours: dash.goals.weeklyHours, dailyTasks: dash.goals.dailyTasks } };
    commit({ dashboard: dash, availability, onboarding }, () => { toast.success("Preferences saved"); onOpenChange(false); });
  };

  const resetTab = () => {
    if (tab === "look") setDash({ ...dash, theme: DEFAULT_THEME, preset: DEFAULT_DASHBOARD.preset, mode: DEFAULT_DASHBOARD.mode });
    if (tab === "study") { setHabits({ sessionMinutes: DEFAULT_PREFS.maxSessionMinutes, breakMinutes: DEFAULT_PREFS.bufferMinutes, preferredTimes: [] }); setAns({ ...ans, taskStyle: "long", focusSupport: false }); }
    if (tab === "availability") setAvail({ ...avail, days: DEFAULT_PREFS.days, maxDailyMinutes: DEFAULT_PREFS.maxDailyMinutes });
    if (tab === "goals") { setDash({ ...dash, goals: DEFAULT_DASHBOARD.goals }); setAns({ ...ans, academicGoal: "" }); }
    if (tab === "access") setDash({ ...dash, accessibility: DEFAULT_ACCESSIBILITY, notifications: DEFAULT_NOTIFICATIONS });
    if (tab === "widgets") setDash((d) => dashboardOf({ ...d, preset: "custom", order: DEFAULT_DASHBOARD.order, hidden: [], homeOrder: undefined, homeHidden: [] }));
  };

  const shownHome = visibleHomeWidgets(dashboardOf(dash));

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand-lavender" /> Personalise My Dashboard</SheetTitle>
            <SheetDescription>Pre-filled with your current choices. Saved to your account.</SheetDescription>
          </SheetHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as PersonaliseTab)} className="flex flex-col gap-4">
            <TabsList className="grid h-auto grid-cols-3 gap-1 sm:grid-cols-6">
              {([["look", "Look", Brush], ["widgets", "Widgets", LayoutGrid], ["study", "Study", Clock], ["availability", "Hours", Calendar], ["goals", "Goals", Target], ["access", "Alerts", Bell]] as const).map(([v, l, Icon]) => (
                <TabsTrigger key={v} value={v} className="flex flex-col gap-0.5 py-1.5 text-xs"><Icon className="h-4 w-4" />{l}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="look" className="mt-0 flex flex-col gap-5">
              <Section title="Colour theme">
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Colour theme">
                  {(Object.keys(THEMES) as ColourTheme[]).map((t) => {
                    const th = THEMES[t], on = themeOf(dash) === t;
                    return (
                      <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setDash({ ...dash, theme: t })}
                        className={cn("rounded-xl border-2 p-3 text-left transition-colors hover:border-brand-lavender", on ? "border-brand-lavender" : "border-border")}>
                        <div className="flex h-9 overflow-hidden rounded-md border" aria-hidden>
                          {[th.primary, th.secondary, th.background, th.charcoal].map((c) => <span key={c} className="flex-1" style={{ backgroundColor: c }} />)}
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">{on && <Check className="h-3.5 w-3.5 text-brand-lavender" />}{th.label}</p>
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Layout">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(PRESETS) as DashboardPreset[]).map((p) => (
                    <button key={p} type="button" onClick={() => pickPreset(p)} aria-pressed={dash.preset === p}
                      className={cn("rounded-xl border-2 p-3 text-left text-sm font-bold transition-colors hover:border-brand-lavender", dash.preset === p ? "border-brand-lavender bg-brand-soft-purple/50" : "border-border")}>
                      {PRESETS[p].label}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{PRESETS[p].habits.sessionMinutes}m focus · {PRESETS[p].habits.breakMinutes}m break</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(["minimal", "detailed"] as const).map((m) => (
                    <Button key={m} type="button" size="sm" variant={dash.mode === m ? "default" : "outline"} className={cn(dash.mode === m && "bg-brand-lavender text-white hover:bg-brand-lavender/90")} onClick={() => custom({ ...dash, mode: m })}>{m === "minimal" ? "Minimal" : "Detailed"}</Button>
                  ))}
                </div>
              </Section>
              <Section title="Live preview">
                <div className="rounded-xl border bg-background p-3" aria-label="Dashboard preview">
                  <div className="grid grid-cols-2 gap-1.5">
                    {shownHome.map((w) => (
                      <div key={w} className={cn("flex h-9 items-center rounded-md bg-card px-2 text-[11px] font-semibold shadow-sm", (w === "welcome" || w === "analytics") && "col-span-2")}>
                        <span className="mr-1.5 h-2 w-2 rounded-full bg-brand-lavender" />{HOME_WIDGETS[w].label}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="widgets" className="mt-0 flex flex-col gap-5">
              <Section title="Main dashboard">
                <WidgetList<HomeWidgetId> order={dashboardOf(dash).homeOrder!} hidden={dashboardOf(dash).homeHidden!} labels={HOME_WIDGETS} onChange={(o, h) => setDash({ ...dash, homeOrder: o, homeHidden: h })} />
                <p className="text-xs text-muted-foreground">Deadline and scheduling warnings always show.</p>
              </Section>
              <Section title="Study Plan · Advanced Planning">
                <WidgetList<WidgetId> order={dash.order} hidden={dash.hidden} labels={WIDGETS} onChange={(o, h) => custom({ ...dash, order: o, hidden: h })} />
              </Section>
            </TabsContent>

            <TabsContent value="study" className="mt-0 flex flex-col gap-5">
              <Toggle label="Concentration support" hint="25-min sessions, 5-min breaks, smaller tasks" checked={!!ans.focusSupport}
                onChange={(on) => { setAns({ ...ans, focusSupport: on, ...(on ? { taskStyle: FOCUS_SUPPORT.taskStyle } : {}) }); if (on) setHabits({ ...habits, sessionMinutes: FOCUS_SUPPORT.sessionMinutes, breakMinutes: FOCUS_SUPPORT.breakMinutes }); }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5"><Label htmlFor="p-session">Session (min)</Label>
                  <Input id="p-session" type="number" min={15} step={5} value={habits.sessionMinutes} onChange={(e) => { setHabits({ ...habits, sessionMinutes: Math.max(15, parseInt(e.target.value) || 15) }); setDash({ ...dash, preset: "custom" }); }} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="p-break">Break (min)</Label>
                  <Input id="p-break" type="number" min={0} step={5} value={habits.breakMinutes} onChange={(e) => { setHabits({ ...habits, breakMinutes: Math.max(0, parseInt(e.target.value) || 0) }); setDash({ ...dash, preset: "custom" }); }} /></div>
              </div>
              <Section title="Task size">
                <div className="grid grid-cols-2 gap-2">
                  {([["small", "Smaller tasks", `Max ${SMALL_TASK_MAX_MINUTES}-min sittings`], ["long", "Longer sessions", "Fewer, deeper sittings"]] as const).map(([v, l, d]) => (
                    <button key={v} type="button" aria-pressed={ans.taskStyle === v} onClick={() => setAns({ ...ans, taskStyle: v })}
                      className={cn("rounded-xl border-2 p-3 text-left text-sm font-bold", ans.taskStyle === v ? "border-brand-lavender bg-brand-soft-purple/50" : "border-border")}>{l}<span className="block text-xs font-normal text-muted-foreground">{d}</span></button>
                  ))}
                </div>
              </Section>
              <Section title="Preferred times">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STUDY_PERIODS) as StudyPeriod[]).map((p) => (
                    <Button key={p} type="button" size="sm" variant="outline" aria-pressed={habits.preferredTimes.includes(p)} onClick={() => togglePeriod(p)}
                      className={cn(habits.preferredTimes.includes(p) && "border-brand-lavender bg-brand-soft-purple/50")}>{STUDY_PERIODS[p].label}</Button>
                  ))}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="availability" className="mt-0 flex flex-col gap-3">
              {ORDER.map((d) => {
                const w = avail.days[d];
                return (
                  <div key={d} className={cn("flex flex-wrap items-center gap-2 rounded-lg border p-2", !w && "bg-muted")}>
                    <Switch checked={!!w} onCheckedChange={(on) => setDay(d, on ? { start: 9, end: 17 } : null)} aria-label={`Study on ${DAY_NAMES[d]}`} />
                    <span className="w-20 text-sm font-semibold">{DAY_NAMES[d].slice(0, 3)}</span>
                    {w ? (
                      <div className="flex items-center gap-1.5">
                        <Input type="time" className="h-8 w-28" aria-label={`${DAY_NAMES[d]} start`} value={toTime(w.start)} onChange={(e) => e.target.value && setDay(d, { ...w, start: fromTime(e.target.value) })} />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input type="time" className="h-8 w-28" aria-label={`${DAY_NAMES[d]} end`} value={toTime(w.end)} onChange={(e) => e.target.value && setDay(d, { ...w, end: fromTime(e.target.value) })} />
                      </div>
                    ) : <span className="text-xs font-semibold text-muted-foreground">Rest day 🌿</span>}
                  </div>
                );
              })}
              <div className="flex flex-col gap-1.5"><Label htmlFor="p-max">Daily maximum (hours)</Label>
                <Input id="p-max" type="number" min={0.5} step={0.5} className="w-32" value={avail.maxDailyMinutes / 60} onChange={(e) => setAvail({ ...avail, maxDailyMinutes: Math.max(30, Math.round((parseFloat(e.target.value) || 0) * 60)) })} /></div>
            </TabsContent>

            <TabsContent value="goals" className="mt-0 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5"><Label htmlFor="p-goal">Academic goal</Label>
                <Textarea id="p-goal" rows={2} maxLength={200} placeholder="e.g. Get a 2:1 in Marketing" value={ans.academicGoal} onChange={(e) => setAns({ ...ans, academicGoal: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5"><Label htmlFor="p-daily">Tasks per day</Label>
                  <Input id="p-daily" type="number" min={1} value={dash.goals.dailyTasks} onChange={(e) => setDash({ ...dash, goals: { ...dash.goals, dailyTasks: Math.max(1, parseInt(e.target.value) || 1) } })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="p-weekly">Focus hours per week</Label>
                  <Input id="p-weekly" type="number" min={1} value={dash.goals.weeklyHours} onChange={(e) => setDash({ ...dash, goals: { ...dash.goals, weeklyHours: Math.max(1, parseFloat(e.target.value) || 1) } })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="mt-0 flex flex-col gap-4">
              <Section title="Notifications (in-app)">
                <Toggle label="XP earned" checked={notif.xp} onChange={(v) => setDash({ ...dash, notifications: { ...notif, xp: v } })} />
                <Toggle label="Achievements" checked={notif.achievements} onChange={(v) => setDash({ ...dash, notifications: { ...notif, achievements: v } })} />
                <Toggle label="Study plan updates" checked={notif.planUpdates} onChange={(v) => setDash({ ...dash, notifications: { ...notif, planUpdates: v } })} />
                <Toggle label="Deadline reminders" hint="Shown on your dashboard" checked={notif.deadlineReminders} onChange={(v) => setDash({ ...dash, notifications: { ...notif, deadlineReminders: v } })} />
              </Section>
              <Section title="Accessibility">
                <Toggle label="Reduce motion" hint="Turns off animations" checked={a11y.reducedMotion} onChange={(v) => setDash({ ...dash, accessibility: { ...a11y, reducedMotion: v } })} />
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> Text size</Label>
                  <div className="flex gap-2">
                    {(["normal", "large", "xlarge"] as const).map((t) => (
                      <Button key={t} type="button" size="sm" variant="outline" aria-pressed={a11y.textSize === t} onClick={() => setDash({ ...dash, accessibility: { ...a11y, textSize: t } })}
                        className={cn(a11y.textSize === t && "border-brand-lavender bg-brand-soft-purple/50")}>{t === "normal" ? "A" : t === "large" ? "A+" : "A++"}</Button>
                    ))}
                  </div>
                </div>
              </Section>
            </TabsContent>
          </Tabs>

          <Button asChild variant="link" className="h-auto w-fit p-0 text-brand-lavender"><Link to="/welcome" onClick={close}>Retake the full Make Momentum Yours questionnaire</Link></Button>

          <SheetFooter className="mt-auto flex-row flex-wrap gap-2 border-t pt-4 sm:justify-between">
            <Button variant="ghost" onClick={resetTab}><RotateCcw className="mr-1.5 h-4 w-4" /> Reset this tab</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={save}>Save</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}
