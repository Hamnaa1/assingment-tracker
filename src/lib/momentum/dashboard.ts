/**
 * Personal Study Plan dashboard preferences. Layout choices live here; study-habit
 * choices (session length, breaks, preferred times) are written into the
 * scheduling engine's SchedulePrefs so they change real schedules.
 */
import type { SchedulePrefs, StudyPeriod } from "./schedule";

export type WidgetId = "risk" | "dailyTasks" | "priorities" | "deadlines" | "workload" | "progress" | "schedule" | "availability" | "weights" | "changes";
export type DashboardPreset = "focus" | "balanced" | "detailed";

export const WIDGETS: Record<WidgetId, { label: string; description: string }> = {
  risk: { label: "Risk warnings", description: "Falling-behind alerts and time shortfalls" },
  dailyTasks: { label: "Today's tasks", description: "Sessions planned today and tasks due" },
  priorities: { label: "Assignment priorities", description: "Ranked by the priority engine" },
  deadlines: { label: "Upcoming deadlines", description: "Next due dates with progress" },
  workload: { label: "Weekly workload", description: "Planned hours per day vs your daily limit" },
  progress: { label: "Progress & goals", description: "Completion and your personal goals" },
  schedule: { label: "Next 7 days", description: "Your scheduled study sessions" },
  availability: { label: "Study availability", description: "Daily study windows and limits" },
  weights: { label: "Priority weights", description: "What matters most when ranking" },
  changes: { label: "Schedule changes", description: "Why your schedule changed" },
};
export const ALL_WIDGETS = Object.keys(WIDGETS) as WidgetId[];

export type ColourTheme = "lavender" | "sky";
export const DEFAULT_THEME: ColourTheme = "lavender";
export const THEMES: Record<ColourTheme, { label: string; primary: string; secondary: string; background: string; charcoal: string }> = {
  lavender: { label: "Lavender Purple", primary: "#9670D4", secondary: "#EDE4FF", background: "#F8F5FF", charcoal: "#242330" },
  sky: { label: "Sky Blue", primary: "#5689DC", secondary: "#DFEBFF", background: "#F4F8FF", charcoal: "#242330" },
};
export const themeOf = (d?: Partial<DashboardPrefs>): ColourTheme => (d?.theme && d.theme in THEMES ? d.theme : DEFAULT_THEME);

export interface StudyGoals {
  weeklyHours: number;
  dailyTasks: number;
}

export interface DashboardPrefs {
  preset: DashboardPreset | "custom";
  mode: "minimal" | "detailed";
  order: WidgetId[];
  hidden: WidgetId[];
  goals: StudyGoals;
  theme?: ColourTheme;
}

export interface Habits {
  sessionMinutes: number;
  breakMinutes: number;
  preferredTimes: StudyPeriod[];
}

export const PRESETS: Record<DashboardPreset, { label: string; description: string; mode: DashboardPrefs["mode"]; visible: WidgetId[]; habits: Pick<Habits, "sessionMinutes" | "breakMinutes"> }> = {
  focus: { label: "Focus", description: "Minimal information, 25-minute sessions with 5-minute breaks.", mode: "minimal", visible: ["risk", "dailyTasks", "priorities", "progress"], habits: { sessionMinutes: 25, breakMinutes: 5 } },
  balanced: { label: "Balanced", description: "Planning plus progress, 50-minute sessions with 10-minute breaks.", mode: "detailed", visible: ["risk", "dailyTasks", "priorities", "deadlines", "progress", "schedule", "availability"], habits: { sessionMinutes: 50, breakMinutes: 10 } },
  detailed: { label: "Detailed", description: "Full analytics and workload, 90-minute sessions with 15-minute breaks.", mode: "detailed", visible: ALL_WIDGETS, habits: { sessionMinutes: 90, breakMinutes: 15 } },
};

export const DEFAULT_DASHBOARD: DashboardPrefs = { preset: "detailed", mode: "detailed", order: ALL_WIDGETS, hidden: [], goals: { weeklyHours: 10, dailyTasks: 3 } };

/** Fills in missing fields and any widgets added since the student last saved. */
export function dashboardOf(saved?: Partial<DashboardPrefs>): DashboardPrefs {
  const d = { ...DEFAULT_DASHBOARD, ...(saved ?? {}), goals: { ...DEFAULT_DASHBOARD.goals, ...(saved?.goals ?? {}) } };
  const order = d.order.filter((w) => ALL_WIDGETS.includes(w));
  return { ...d, theme: themeOf(d), order: [...order, ...ALL_WIDGETS.filter((w) => !order.includes(w))], hidden: d.hidden.filter((w) => ALL_WIDGETS.includes(w)) };
}

export const visibleWidgets = (d: DashboardPrefs) => d.order.filter((w) => !d.hidden.includes(w));

export function applyPreset(d: DashboardPrefs, preset: DashboardPreset): { dashboard: DashboardPrefs; habits: Pick<Habits, "sessionMinutes" | "breakMinutes"> } {
  const p = PRESETS[preset];
  return { dashboard: { ...d, preset, mode: p.mode, hidden: ALL_WIDGETS.filter((w) => !p.visible.includes(w)) }, habits: p.habits };
}

export const habitsOf = (prefs: SchedulePrefs): Habits => ({ sessionMinutes: prefs.maxSessionMinutes, breakMinutes: prefs.bufferMinutes, preferredTimes: prefs.preferredTimes ?? [] });

/** Writes study-habit preferences into the scheduling engine's settings. */
export const withHabits = (prefs: SchedulePrefs, h: Habits): SchedulePrefs => ({
  ...prefs,
  maxSessionMinutes: Math.max(15, Math.round(h.sessionMinutes)),
  bufferMinutes: Math.max(0, Math.round(h.breakMinutes)),
  preferredTimes: h.preferredTimes,
});

export function moveWidget(order: WidgetId[], id: WidgetId, dir: -1 | 1): WidgetId[] {
  const i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
