import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMomentum } from "@/lib/momentum/store";
import { prefsOf } from "@/lib/momentum/engine";
import { PRESETS, THEMES, themeOf, WIDGETS, visibleWidgets, type ColourTheme, type DashboardPreset } from "@/lib/momentum/dashboard";
import { STUDY_PERIODS, type StudyPeriod } from "@/lib/momentum/schedule";
import { defaultAnswers, profileFromAnswers, sessionLength, withFocusSupport, type OnboardingAnswers } from "@/lib/momentum/onboarding";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toTime = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const fromTime = (s: string) => { const [h, m] = s.split(":").map(Number); return h + (m || 0) / 60; };

function Choice({ selected, onClick, title, desc, children }: { selected: boolean; onClick: () => void; title: string; desc?: string; children?: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={cn("flex flex-col gap-2 rounded-xl border-2 bg-card p-4 text-left transition-all hover:border-brand-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-brand-lavender bg-brand-soft-purple/60 shadow-sm" : "border-border")}>
      {children}
      <span className="flex items-center gap-1.5 text-sm font-bold">{selected && <Check className="h-4 w-4 text-brand-lavender" />}{title}</span>
      {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
    </button>
  );
}

export default function Onboarding() {
  const { state, dispatch } = useMomentum();
  const navigate = useNavigate();
  const [a, setA] = useState<OnboardingAnswers>(() => state.onboarding?.answers ?? defaultAnswers(state.dashboard, state.availability ? prefsOf(state) : undefined));
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<OnboardingAnswers>) => setA((x) => ({ ...x, ...p }));

  // Live theme preview while onboarding; restore the saved theme on leave.
  useEffect(() => { document.documentElement.dataset.theme = a.theme; }, [a.theme]);
  const savedTheme = themeOf(state.dashboard);
  useEffect(() => () => { document.documentElement.dataset.theme = savedTheme; }, [savedTheme]);

  const profile = useMemo(() => profileFromAnswers(a, state.dashboard, prefsOf(state)), [a, state]);
  const hasExisting = !!(state.dashboard || state.availability);

  const steps: { title: string; sub: string; body: ReactNode }[] = [
    { title: "Pick your colour theme", sub: "You can change this any time in Customise Dashboard.", body: (
      <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(THEMES) as ColourTheme[]).map((t) => (
          <Choice key={t} selected={a.theme === t} onClick={() => set({ theme: t })} title={THEMES[t].label} desc={t === "lavender" ? "Default" : undefined}>
            <span className="flex h-12 overflow-hidden rounded-lg border" aria-hidden>
              {[THEMES[t].primary, THEMES[t].secondary, THEMES[t].background, THEMES[t].charcoal].map((c) => <span key={c} className="flex-1" style={{ backgroundColor: c }} />)}
            </span>
          </Choice>
        ))}
      </div>) },
    { title: "Do you find it hard to stay focused?", sub: "If so, we'll suggest shorter sessions, bite-sized tasks, regular breaks and a simpler dashboard.", body: (
      <div role="radiogroup" aria-label="Concentration support" className="grid gap-3 sm:grid-cols-2">
        <Choice selected={a.focusSupport} onClick={() => setA(withFocusSupport(a))} title="Yes, help me focus" desc="25-minute sessions, 5-minute breaks, small tasks, Focus dashboard." />
        <Choice selected={!a.focusSupport} onClick={() => set({ focusSupport: false })} title="No, I'm fine" desc="I'll choose my own session lengths." />
      </div>) },
    { title: "How long do you like to study in one go?", sub: "Your scheduler won't plan sittings longer than this.", body: (
      <div role="radiogroup" aria-label="Session length" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[25, 45, 60, 90].map((m) => <Choice key={m} selected={a.sessionMinutes === m} onClick={() => set({ sessionMinutes: m })} title={`${m} min`} desc={m === 25 ? "Pomodoro" : m === 90 ? "Deep work" : undefined} />)}
      </div>) },
    { title: "How often do you want breaks?", sub: "A break is added after every session.", body: (
      <div role="radiogroup" aria-label="Break length" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[5, 10, 15, 20].map((m) => <Choice key={m} selected={a.breakMinutes === m} onClick={() => set({ breakMinutes: m })} title={`${m} min break`} desc={`every ${sessionLength(a)} min`} />)}
      </div>) },
    { title: "When are you free to study?", sub: "Sessions are only scheduled inside these windows.", body: (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {ORDER.map((i) => { const d = a.days[i]; return (
            <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <Switch checked={!!d} aria-label={`Study on ${DAY_NAMES[i]}`} onCheckedChange={(on) => set({ days: a.days.map((x, j) => (j === i ? (on ? { start: 9, end: 18 } : null) : x)) })} />
              <span className="w-24 text-sm font-semibold">{DAY_NAMES[i]}</span>
              {d ? (<>
                <Input type="time" aria-label={`${DAY_NAMES[i]} start`} className="w-32" value={toTime(d.start)} onChange={(e) => set({ days: a.days.map((x, j) => (j === i ? { ...d, start: fromTime(e.target.value) } : x)) })} />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="time" aria-label={`${DAY_NAMES[i]} end`} className="w-32" value={toTime(d.end)} onChange={(e) => set({ days: a.days.map((x, j) => (j === i ? { ...d, end: fromTime(e.target.value) } : x)) })} />
              </>) : <span className="text-sm text-muted-foreground">Day off</span>}
            </li>); })}
        </ul>
        <div className="flex items-center gap-3"><Label htmlFor="ob-daily">Most study per day (hours)</Label>
          <Input id="ob-daily" type="number" min={0.5} step={0.5} className="w-24" value={a.dailyHours} onChange={(e) => set({ dailyHours: Math.max(0.5, parseFloat(e.target.value) || 0.5) })} /></div>
      </div>) },
    { title: "When do you study best?", sub: "These times are filled first. Pick none for no preference.", body: (
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(STUDY_PERIODS) as StudyPeriod[]).map((p) => { const on = a.preferredTimes.includes(p); return (
          <button key={p} type="button" aria-pressed={on} onClick={() => set({ preferredTimes: on ? a.preferredTimes.filter((x) => x !== p) : [...a.preferredTimes, p] })}
            className={cn("rounded-xl border-2 bg-card p-4 text-left text-sm font-bold transition-all hover:border-brand-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-brand-lavender bg-brand-soft-purple/60" : "border-border")}>
            <span className="flex items-center gap-1.5">{on && <Check className="h-4 w-4 text-brand-lavender" />}{STUDY_PERIODS[p].label}</span>
          </button>); })}
      </div>) },
    { title: "Smaller tasks or longer sessions?", sub: "Smaller tasks split work into sittings of 30 minutes or less.", body: (
      <div role="radiogroup" aria-label="Task style" className="grid gap-3 sm:grid-cols-2">
        <Choice selected={a.taskStyle === "small"} onClick={() => set({ taskStyle: "small" })} title="Smaller, manageable tasks" desc="Short sittings, easy to start." />
        <Choice selected={a.taskStyle === "long"} onClick={() => set({ taskStyle: "long" })} title="Longer study sessions" desc={`Uses your full ${a.sessionMinutes}-minute sessions.`} />
      </div>) },
    { title: "What are your academic goals?", sub: "Your goals appear on your Study Plan progress widget.", body: (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5"><Label htmlFor="ob-goal">Your main goal (optional)</Label>
          <Textarea id="ob-goal" placeholder="e.g. Get a 2:1 this term and stop leaving essays to the last minute" value={a.academicGoal} maxLength={200} onChange={(e) => set({ academicGoal: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5"><Label htmlFor="ob-weekly">Study hours per week</Label>
            <Input id="ob-weekly" type="number" min={1} value={a.weeklyHours} onChange={(e) => set({ weeklyHours: Math.max(1, parseFloat(e.target.value) || 1) })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ob-tasks">Tasks to finish per day</Label>
            <Input id="ob-tasks" type="number" min={1} value={a.dailyTasks} onChange={(e) => set({ dailyTasks: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
        </div>
      </div>) },
    { title: "Choose your dashboard layout", sub: "Decides which widgets your Study Plan shows.", body: (
      <div role="radiogroup" aria-label="Dashboard layout" className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(PRESETS) as DashboardPreset[]).map((p) => <Choice key={p} selected={a.layout === p} onClick={() => set({ layout: p })} title={PRESETS[p].label} desc={`${PRESETS[p].visible.length} widgets · ${PRESETS[p].mode}`} />)}
      </div>) },
    { title: "Your study profile", sub: "Here's how Momentum will work for you.", body: (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Theme", THEMES[a.theme].label],
          ["Study sessions", `${profile.availability.maxSessionMinutes} min, then a ${profile.availability.bufferMinutes}-min break${a.taskStyle === "small" ? " (small tasks)" : ""}`],
          ["Study days", `${a.days.filter(Boolean).length} days a week, up to ${a.dailyHours}h a day`],
          ["Best times", a.preferredTimes.length ? a.preferredTimes.map((p) => STUDY_PERIODS[p].label).join(", ") : "No preference"],
          ["Goals", `${a.weeklyHours}h a week · ${a.dailyTasks} tasks a day`],
          ["Dashboard", `${PRESETS[a.layout].label}: ${visibleWidgets(profile.dashboard).map((w) => WIDGETS[w].label).join(", ")}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-card p-3"><p className="text-xs font-semibold text-muted-foreground">{k}</p><p className="text-sm font-semibold">{v}</p></div>
        ))}
        {a.academicGoal && <div className="rounded-lg border bg-brand-soft-purple/60 p-3 sm:col-span-2"><p className="text-xs font-semibold text-muted-foreground">Your goal</p><p className="text-sm font-semibold">{a.academicGoal}</p></div>}
        {a.focusSupport && <p className="text-sm text-muted-foreground sm:col-span-2">Focus support is on: shorter sittings, regular breaks and a simplified dashboard.</p>}
      </div>) },
  ];

  const last = steps.length - 1;
  const apply = () => {
    dispatch({ type: "setOnboarding", onboarding: { status: "completed", at: new Date().toISOString(), answers: a }, ...profile });
    toast.success("Momentum is now yours", { description: "Use Auto-reschedule on your Study Plan to apply these to sessions already planned." });
    navigate("/plan");
  };
  const finish = () => (hasExisting ? setConfirm(true) : apply());
  const skip = () => {
    if (!state.onboarding) dispatch({ type: "setOnboarding", onboarding: { status: "skipped", at: new Date().toISOString() } });
    navigate("/dashboard");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-brand-lavender"><Sparkles className="h-4 w-4" /> Make Momentum Yours</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{steps[step].title}</h1>
          <p className="text-sm text-muted-foreground">{steps[step].sub}</p>
        </div>
        <Button variant="ghost" onClick={skip}>Skip for now</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Progress value={((step + 1) / steps.length) * 100} aria-label={`Step ${step + 1} of ${steps.length}`} className="h-2 bg-brand-soft-purple [&>div]:bg-brand-lavender" />
        <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">Step {step + 1} of {steps.length}</p>
      </div>
      <Card className="border-border/80 bg-brand-soft-white shadow-sm"><CardContent className="p-5">{steps[step].body}</CardContent></Card>
      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button>
        {step < last
          ? <Button onClick={() => setStep(step + 1)}>Next<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          : <Button onClick={finish}><Check className="mr-1.5 h-4 w-4" />Save my profile</Button>}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current settings?</AlertDialogTitle>
            <AlertDialogDescription>This updates your theme, dashboard layout, goals, session length, breaks, study times and daily availability. Your assignments, tasks and planned sessions stay as they are.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current settings</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Replace settings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
