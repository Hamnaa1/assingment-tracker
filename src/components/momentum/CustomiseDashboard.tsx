import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMomentum } from "@/lib/momentum/store";
import { prefsOf } from "@/lib/momentum/engine";
import { DEFAULT_THEME, THEMES, themeOf, type ColourTheme, PRESETS, WIDGETS, applyPreset, dashboardOf, habitsOf, moveWidget, withHabits, type DashboardPreset, type DashboardPrefs, type Habits } from "@/lib/momentum/dashboard";
import { STUDY_PERIODS, type StudyPeriod } from "@/lib/momentum/schedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CustomiseDashboard({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, dispatch } = useMomentum();
  const [dash, setDash] = useState<DashboardPrefs>(dashboardOf(state.dashboard));
  const [habits, setHabits] = useState<Habits>(habitsOf(prefsOf(state)));

  useEffect(() => {
    if (open) { setDash(dashboardOf(state.dashboard)); setHabits(habitsOf(prefsOf(state))); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const custom = (d: DashboardPrefs) => setDash({ ...d, preset: "custom" });
  const pickPreset = (p: DashboardPreset) => { const r = applyPreset(dash, p); setDash(r.dashboard); setHabits({ ...habits, ...r.habits }); };
  const togglePeriod = (p: StudyPeriod) => setHabits({ ...habits, preferredTimes: habits.preferredTimes.includes(p) ? habits.preferredTimes.filter((x) => x !== p) : [...habits.preferredTimes, p] });

  const pickTheme = (theme: ColourTheme) => {
    setDash({ ...dash, theme });
    // Applied and saved straight away so the whole app recolours immediately.
    dispatch({ type: "setDashboard", dashboard: { ...dashboardOf(state.dashboard), theme } });
  };

  const save = () => {
    if (dash.hidden.length === dash.order.length) return toast.error("Keep at least one widget on your dashboard");
    dispatch({ type: "setDashboard", dashboard: dash, availability: withHabits(prefsOf(state), habits) });
    toast.success("Dashboard saved", { description: "Study habits updated. Auto-reschedule to apply them to existing sessions." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customise dashboard</DialogTitle>
          <DialogDescription>Saved to your account. Session length, breaks and study times feed straight into your schedule.</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Presets</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PRESETS) as DashboardPreset[]).map((p) => (
              <button key={p} type="button" onClick={() => pickPreset(p)} aria-pressed={dash.preset === p}
                className={cn("rounded-lg border p-3 text-left transition-colors hover:border-brand-lavender", dash.preset === p && "border-brand-lavender bg-brand-soft-purple/40")}>
                <p className="flex items-center gap-1.5 text-sm font-bold">{dash.preset === p && <Check className="h-3.5 w-3.5 text-brand-lavender" />}{PRESETS[p].label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{PRESETS[p].description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="cd-theme">
          <div className="flex items-center justify-between">
            <h3 id="cd-theme" className="text-sm font-bold">Colour Theme</h3>
            <Button type="button" size="sm" variant="ghost" disabled={themeOf(dash) === DEFAULT_THEME} onClick={() => pickTheme(DEFAULT_THEME)}>Reset to default</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Colour theme">
            {(Object.keys(THEMES) as ColourTheme[]).map((t) => {
              const th = THEMES[t], on = themeOf(dash) === t;
              return (
                <button key={t} type="button" role="radio" aria-checked={on} onClick={() => pickTheme(t)}
                  className={cn("rounded-lg border p-3 text-left transition-colors hover:border-brand-lavender", on && "border-2 border-brand-lavender")}>
                  <div className="flex h-10 overflow-hidden rounded-md border" aria-hidden>
                    {[th.primary, th.secondary, th.background, th.charcoal].map((c) => <span key={c} className="flex-1" style={{ backgroundColor: c }} />)}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">{on && <Check className="h-3.5 w-3.5 text-brand-lavender" />}{th.label}{t === DEFAULT_THEME && <span className="text-xs font-normal text-muted-foreground">(default)</span>}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">View</h3>
          <div className="flex gap-2">
            {(["minimal", "detailed"] as const).map((m) => (
              <Button key={m} type="button" variant={dash.mode === m ? "default" : "outline"} className={cn(dash.mode === m && "bg-brand-lavender text-white hover:bg-brand-lavender/90")} onClick={() => custom({ ...dash, mode: m })}>
                {m === "minimal" ? "Minimal" : "Detailed"}
              </Button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Widgets</h3>
          <ul className="flex flex-col gap-1.5">
            {dash.order.map((id, i) => (
              <li key={id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch checked={!dash.hidden.includes(id)} aria-label={`Show ${WIDGETS[id].label}`}
                  onCheckedChange={(on) => custom({ ...dash, hidden: on ? dash.hidden.filter((w) => w !== id) : [...dash.hidden, id] })} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{WIDGETS[id].label}</p>
                  <p className="truncate text-xs text-muted-foreground">{WIDGETS[id].description}</p>
                </div>
                <Button size="icon" variant="ghost" disabled={i === 0} aria-label={`Move ${WIDGETS[id].label} up`} onClick={() => custom({ ...dash, order: moveWidget(dash.order, id, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={i === dash.order.length - 1} aria-label={`Move ${WIDGETS[id].label} down`} onClick={() => custom({ ...dash, order: moveWidget(dash.order, id, 1) })}><ArrowDown className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">Study habits</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="cd-session">Session length (min)</Label>
              <Input id="cd-session" type="number" min={15} step={5} value={habits.sessionMinutes} onChange={(e) => { setHabits({ ...habits, sessionMinutes: parseInt(e.target.value) || 15 }); setDash({ ...dash, preset: "custom" }); }} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="cd-break">Break after each session (min)</Label>
              <Input id="cd-break" type="number" min={0} step={5} value={habits.breakMinutes} onChange={(e) => { setHabits({ ...habits, breakMinutes: parseInt(e.target.value) || 0 }); setDash({ ...dash, preset: "custom" }); }} /></div>
          </div>
          <p className="text-xs text-muted-foreground">You'll get a break every {Math.max(15, habits.sessionMinutes)} minutes of study.</p>
          <div className="flex flex-col gap-1.5">
            <Label>Preferred study times</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STUDY_PERIODS) as StudyPeriod[]).map((p) => (
                <Button key={p} type="button" size="sm" variant="outline" aria-pressed={habits.preferredTimes.includes(p)} onClick={() => togglePeriod(p)}
                  className={cn(habits.preferredTimes.includes(p) && "border-brand-lavender bg-brand-soft-purple/50")}>{STUDY_PERIODS[p].label}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{habits.preferredTimes.length ? "These times are filled first each day, inside your availability." : "No preference — earliest free time is used."}</p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">Personal goals</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="cd-weekly">Study hours per week</Label>
              <Input id="cd-weekly" type="number" min={1} step={1} value={dash.goals.weeklyHours} onChange={(e) => setDash({ ...dash, goals: { ...dash.goals, weeklyHours: Math.max(1, parseFloat(e.target.value) || 1) } })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="cd-daily">Tasks to finish per day</Label>
              <Input id="cd-daily" type="number" min={1} step={1} value={dash.goals.dailyTasks} onChange={(e) => setDash({ ...dash, goals: { ...dash.goals, dailyTasks: Math.max(1, parseInt(e.target.value) || 1) } })} /></div>
          </div>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={save}>Save dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
