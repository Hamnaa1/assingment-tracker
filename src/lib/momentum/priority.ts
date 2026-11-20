import type { Assignment, PriorityBreakdown, PriorityLevel, Task } from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function daysUntil(isoDate: string, now = new Date()): number {
  const due = new Date(isoDate);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function completionPct(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

export function remainingMinutes(tasks: Task[]): number {
  return tasks.filter((t) => !t.completed).reduce((sum, t) => sum + t.estimatedMinutes, 0);
}

export function levelForScore(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Momentum Priority engine.
 * Deadline urgency 40% · remaining workload 25% · weighting 20% · risk of falling behind 15%.
 */
export function computePriority(assignment: Assignment, tasks: Task[], now = new Date()): PriorityBreakdown {
  const days = daysUntil(assignment.deadline, now);
  const done = completionPct(tasks);
  const remaining = remainingMinutes(tasks);

  // Urgency: overdue = 100, due today = 95, scales down over a 3-week horizon.
  const urgency = days < 0 ? 100 : clamp(95 - days * 4.5, 5, 100);

  // Remaining workload.
  const workload = 100 - done;

  // Importance from module weighting (40% weighting -> 100).
  const importance = clamp((assignment.weighting ?? 20) * 2.5, 10, 100);

  // Risk: remaining hours vs available study hours (assumes 4 focused hours/day).
  const availableHours = Math.max(days, 0.5) * 4;
  const neededHours = remaining / 60;
  const risk = clamp((neededHours / availableHours) * 100, 0, 100);

  const score = Math.round(clamp(urgency * 0.4 + workload * 0.25 + importance * 0.2 + risk * 0.15));
  const level = levelForScore(score);

  const dueText =
    days < 0
      ? `is overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
      : days === 0
        ? "is due today"
        : `is due in ${days} day${days === 1 ? "" : "s"}`;

  const explanation = `Priority ${score} — ${level.charAt(0).toUpperCase() + level.slice(1)}. "${assignment.title}" ${dueText}, contributes ${assignment.weighting ?? 20}% of your module grade, and you have completed ${done}% of the required work (${Math.round(neededHours * 10) / 10}h remaining).`;

  return {
    score,
    level,
    urgency: Math.round(urgency),
    workload: Math.round(workload),
    importance: Math.round(importance),
    risk: Math.round(risk),
    explanation,
  };
}

export const LEVEL_STYLES: Record<PriorityLevel, { badge: string; bar: string; label: string }> = {
  critical: { badge: "bg-brand-error/10 text-brand-error border-brand-error/30", bar: "bg-brand-error", label: "Critical" },
  high: { badge: "bg-brand-warning/10 text-brand-warning border-brand-warning/30", bar: "bg-brand-warning", label: "High" },
  medium: { badge: "bg-brand-lavender/10 text-brand-lavender border-brand-lavender/30", bar: "bg-brand-lavender", label: "Medium" },
  low: { badge: "bg-muted text-muted-foreground border-border", bar: "bg-muted-foreground", label: "Low" },
};
