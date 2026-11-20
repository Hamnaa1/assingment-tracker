/**
 * "Make Momentum Yours" onboarding. Answers are turned into the existing
 * DashboardPrefs + SchedulePrefs (no separate settings), so the Study Plan
 * dashboard and the scheduling engine pick them up directly.
 */
import { applyPreset, dashboardOf, withHabits, type ColourTheme, type DashboardPreset, type DashboardPrefs } from "./dashboard";
import type { ProfileInfo } from "./persona";
import type { DayWindow, SchedulePrefs, StudyPeriod } from "./schedule";

export type TaskStyle = "small" | "long";

export interface OnboardingAnswers extends ProfileInfo {
  theme: ColourTheme;
  focusSupport: boolean; // student finds it hard to concentrate
  sessionMinutes: number;
  breakMinutes: number;
  days: (DayWindow | null)[]; // 0 = Sunday
  dailyHours: number;
  preferredTimes: StudyPeriod[];
  taskStyle: TaskStyle;
  academicGoal: string;
  weeklyHours: number;
  dailyTasks: number;
  layout: DashboardPreset;
}

export interface OnboardingRecord {
  status: "completed" | "skipped";
  at: string;
  answers?: OnboardingAnswers;
}

/** Longest sitting when a student prefers smaller, bite-sized tasks. */
export const SMALL_TASK_MAX_MINUTES = 30;
/** Concentration-support settings. */
export const FOCUS_SUPPORT = { sessionMinutes: 25, breakMinutes: 5, taskStyle: "small" as TaskStyle, layout: "focus" as DashboardPreset, dailyTasks: 2 };

export function defaultAnswers(dash?: Partial<DashboardPrefs>, prefs?: SchedulePrefs): OnboardingAnswers {
  const d = dashboardOf(dash);
  return {
    persona: "student",
    subject: "",
    level: "",
    role: "",
    struggles: [],
    theme: d.theme ?? "lavender",
    focusSupport: false,
    sessionMinutes: prefs?.maxSessionMinutes ?? 50,
    breakMinutes: prefs?.bufferMinutes ?? 10,
    days: prefs?.days ?? Array.from({ length: 7 }, (_, i) => (i === 0 || i === 6 ? null : { start: 9, end: 18 })),
    dailyHours: prefs ? Math.round(prefs.maxDailyMinutes / 60) : 3,
    preferredTimes: prefs?.preferredTimes ?? [],
    taskStyle: "long",
    academicGoal: "",
    weeklyHours: d.goals.weeklyHours,
    dailyTasks: d.goals.dailyTasks,
    layout: d.preset === "custom" ? "balanced" : d.preset,
  };
}

/** Pre-fills the concentration-friendly options; the student can still change them. */
export const withFocusSupport = (a: OnboardingAnswers): OnboardingAnswers => ({ ...a, focusSupport: true, ...FOCUS_SUPPORT, dailyTasks: Math.min(a.dailyTasks, FOCUS_SUPPORT.dailyTasks) });

/** Effective session length after the task-style preference. */
export const sessionLength = (a: OnboardingAnswers) => Math.max(15, a.taskStyle === "small" ? Math.min(a.sessionMinutes, SMALL_TASK_MAX_MINUTES) : a.sessionMinutes);

/** Converts answers into the existing dashboard and scheduling settings. */
export function profileFromAnswers(a: OnboardingAnswers, dash: Partial<DashboardPrefs> | undefined, prefs: SchedulePrefs): { dashboard: DashboardPrefs; availability: SchedulePrefs } {
  const base = applyPreset(dashboardOf(dash), a.layout).dashboard;
  const dashboard: DashboardPrefs = { ...base, theme: a.theme, goals: { weeklyHours: Math.max(1, a.weeklyHours), dailyTasks: Math.max(1, a.dailyTasks) } };
  const availability: SchedulePrefs = {
    ...withHabits(prefs, { sessionMinutes: sessionLength(a), breakMinutes: a.breakMinutes, preferredTimes: a.preferredTimes }),
    days: a.days.map((d) => (d && d.end > d.start ? { ...d } : null)),
    maxDailyMinutes: Math.max(15, Math.round(a.dailyHours * 60)),
  };
  return { dashboard, availability };
}

/** Only brand-new students (nothing customised yet) get onboarding automatically. */
export const needsOnboarding = (ws: { onboarding?: OnboardingRecord; dashboard?: unknown }) => !ws.onboarding && !ws.dashboard;
