/**
 * XP, levels and achievements. Reward amounts are configured centrally in the
 * `xp_rewards` table and awarded only by the server (`sync_xp`); the values here
 * mirror the defaults for display before the table has loaded.
 */
export type RewardReason = "focus_minute" | "task_complete" | "daily_goal" | "on_time_submission" | "streak_7";

export const DEFAULT_REWARDS: Record<RewardReason, { amount: number; label: string; dailyCap?: number }> = {
  focus_minute: { amount: 1, label: "Focus minute", dailyCap: 240 },
  task_complete: { amount: 30, label: "Task completed" },
  daily_goal: { amount: 50, label: "Daily goal met" },
  on_time_submission: { amount: 100, label: "Finished on time" },
  streak_7: { amount: 150, label: "7-day streak" },
};

/** Cumulative XP needed to reach each level (index 0 = level 1). */
export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];
const TITLES: [number, string][] = [
  [1, "Getting Started"],
  [3, "Focus Builder"],
  [5, "Momentum Master"],
  [7, "Academic Achiever"],
  [9, "Deep Focus Pro"],
  [11, "Momentum Legend"],
];

export const thresholdFor = (level: number) =>
  level <= LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level - 1] : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 1200;

export interface LevelInfo { level: number; title: string; totalXp: number; intoLevel: number; levelSize: number; toNext: number; pct: number }

export function levelFor(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (thresholdFor(level + 1) <= xp) level++;
  const start = thresholdFor(level), next = thresholdFor(level + 1);
  const title = [...TITLES].reverse().find(([l]) => level >= l)![1];
  return { level, title, totalXp: xp, intoLevel: xp - start, levelSize: next - start, toNext: next - xp, pct: Math.round(((xp - start) / (next - start)) * 100) };
}

export type AchievementId = "first_focus" | "first_task" | "streak_3" | "streak_7" | "ten_focus" | "weekly_goal" | "plan_complete";
export const ACHIEVEMENTS: Record<AchievementId, { label: string; hint: string; emoji: string }> = {
  first_focus: { label: "First Lock-In", hint: "Complete your first focus session", emoji: "🎯" },
  first_task: { label: "First Tick", hint: "Complete your first task", emoji: "✅" },
  streak_3: { label: "On a Roll", hint: "Study 3 days in a row", emoji: "🔥" },
  streak_7: { label: "Week Warrior", hint: "Study 7 days in a row (rest days don't count against you)", emoji: "🏆" },
  ten_focus: { label: "Ten Sessions", hint: "Complete 10 focus sessions", emoji: "⏱️" },
  weekly_goal: { label: "Goal Getter", hint: "Meet your weekly focus-time goal", emoji: "📈" },
  plan_complete: { label: "Plan Finisher", hint: "Finish every task of an assignment before its deadline", emoji: "🎓" },
};
export const ALL_ACHIEVEMENTS = Object.keys(ACHIEVEMENTS) as AchievementId[];

/** Leaderboard row as returned by `friend_leaderboard`. */
export interface BoardRow {
  user_id: string; display_name: string; avatar: string; is_me: boolean; opted_in: boolean;
  total_xp: number; period_xp: number; focus_minutes: number | null; tasks: number; goal_days: number; streak: number | null;
}
export type BoardMetric = "xp" | "focus" | "tasks" | "consistency";

export const metricValue = (r: BoardRow, m: BoardMetric, periodDays: number) =>
  m === "xp" ? Number(r.period_xp) : m === "focus" ? Number(r.focus_minutes ?? 0) : m === "tasks" ? Number(r.tasks) : Math.round((Number(r.goal_days) / Math.max(1, periodDays)) * 100);

/** Ranks rows (ties share a rank) and hides students who opted out, except yourself. */
export function rankBoard(rows: BoardRow[], m: BoardMetric, periodDays: number) {
  const list = rows.filter((r) => r.opted_in || r.is_me).map((r) => ({ ...r, value: metricValue(r, m, periodDays) }));
  list.sort((a, b) => b.value - a.value || a.display_name.localeCompare(b.display_name));
  let rank = 0, prev = Number.NaN;
  return list.map((r, i) => { if (r.value !== prev) { rank = i + 1; prev = r.value; } return { ...r, rank }; });
}

/** Leaderboard period windows; weekly starts Monday. */
export type BoardPeriod = "week" | "month" | "all";
export function periodRange(p: BoardPeriod, now = new Date(), offset = 0): { from: Date; to: Date; days: number } {
  if (p === "all") return { from: new Date(2000, 0, 1), to: new Date(now.getTime() + 86400000), days: 365 };
  if (p === "week") {
    const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - ((from.getDay() + 6) % 7) - offset * 7);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    return { from, to, days: 7 };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  return { from, to, days: Math.round((to.getTime() - from.getTime()) / 86400000) };
}
