import type { Assignment, PriorityBreakdown, PriorityLevel, Task } from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function daysUntil(isoDate: string, now = new Date()): number {
  const due = new Date(isoDate);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function completionPct(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((s, t) => s + Math.max(t.estimatedMinutes, 15), 0);
  const done = tasks.filter((t) => t.completed).reduce((s, t) => s + Math.max(t.estimatedMinutes, 15), 0);
  return Math.round((done / total) * 100);
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

/** Relative importance of each factor; normalised so they always sum to 100%. Editable per student. */
export interface PriorityWeights {
  urgency: number;
  workload: number;
  importance: number;
  difficulty: number;
  risk: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = { urgency: 35, workload: 20, importance: 20, difficulty: 10, risk: 15 };

export const FACTOR_LABELS: Record<keyof PriorityWeights, string> = {
  urgency: "Deadline urgency",
  workload: "Remaining workload",
  importance: "Grade weighting",
  difficulty: "Difficulty",
  risk: "Fall-behind risk",
};

export function normaliseWeights(w: PriorityWeights): PriorityWeights {
  const total = Object.values(w).reduce((s, v) => s + Math.max(0, v), 0) || 1;
  return {
    urgency: (Math.max(0, w.urgency) / total) * 100,
    workload: (Math.max(0, w.workload) / total) * 100,
    importance: (Math.max(0, w.importance) / total) * 100,
    difficulty: (Math.max(0, w.difficulty) / total) * 100,
    risk: (Math.max(0, w.risk) / total) * 100,
  };
}

export interface PriorityOptions {
  weights?: PriorityWeights;
  /** Free study minutes before the deadline (from availability + calendar). Defaults to 4h/day. */
  availableMinutes?: number;
}

/**
 * Momentum priority engine. Each factor is scored 0–100, then combined using
 * the student's (normalised) weights:
 *  - urgency: overdue 100, due today 95, falling 4.5 points per day
 *  - workload: % of estimated work still to do
 *  - importance: grade weighting (40% of module → 100)
 *  - difficulty: 1–5 → 20–100
 *  - risk: hours still needed ÷ free study hours before the deadline
 */
export function computePriority(assignment: Assignment, tasks: Task[], now = new Date(), opts: PriorityOptions = {}): PriorityBreakdown {
  const w = normaliseWeights(opts.weights ?? DEFAULT_WEIGHTS);
  const days = daysUntil(assignment.deadline, now);
  const done = completionPct(tasks);
  const remaining = remainingMinutes(tasks);

  const urgency = days < 0 ? 100 : clamp(95 - days * 4.5, 5, 100);
  const workload = tasks.length ? 100 - done : 100;
  const importance = clamp((assignment.weighting ?? 20) * 2.5, 10, 100);
  const difficulty = clamp(assignment.difficulty * 20, 20, 100);
  const availableMin = opts.availableMinutes ?? Math.max(days, 0.5) * 240;
  const neededHours = remaining / 60;
  const risk = remaining === 0 ? 0 : availableMin <= 0 ? 100 : clamp((remaining / availableMin) * 100, 0, 100);

  const parts = {
    urgency: (urgency * w.urgency) / 100,
    workload: (workload * w.workload) / 100,
    importance: (importance * w.importance) / 100,
    difficulty: (difficulty * w.difficulty) / 100,
    risk: (risk * w.risk) / 100,
  };
  const score = Math.round(clamp(Object.values(parts).reduce((s, v) => s + v, 0)));
  const level = levelForScore(score);

  const dueText =
    days < 0 ? `is overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}` : days === 0 ? "is due today" : `is due in ${days} day${days === 1 ? "" : "s"}`;
  const top = (Object.keys(parts) as (keyof typeof parts)[]).sort((a, b) => parts[b] - parts[a]).slice(0, 2).map((k) => FACTOR_LABELS[k].toLowerCase());
  const availH = Math.round((availableMin / 60) * 10) / 10;
  const riskText = remaining === 0 ? "" : ` You need about ${Math.round(neededHours * 10) / 10}h and have roughly ${availH}h of free study time before it's due${risk >= 80 ? " — that's very tight" : ""}.`;
  const explanation = `Priority ${score} — ${level.charAt(0).toUpperCase() + level.slice(1)}. "${assignment.title}" ${dueText}, is worth ${assignment.weighting ?? 20}% of your module grade, is rated ${assignment.difficulty}/5 for difficulty, and is ${done}% complete. Biggest drivers: ${top.join(" and ")}.${riskText}`;

  return {
    score,
    level,
    urgency: Math.round(urgency),
    workload: Math.round(workload),
    importance: Math.round(importance),
    difficulty: Math.round(difficulty),
    risk: Math.round(risk),
    weights: w,
    explanation,
  };
}

export const LEVEL_STYLES: Record<PriorityLevel, { badge: string; bar: string; label: string }> = {
  critical: { badge: "bg-brand-error/10 text-brand-error border-brand-error/30", bar: "bg-brand-error", label: "Critical" },
  high: { badge: "bg-brand-warning/10 text-brand-warning border-brand-warning/30", bar: "bg-brand-warning", label: "High" },
  medium: { badge: "bg-brand-lavender/10 text-brand-lavender border-brand-lavender/30", bar: "bg-brand-lavender", label: "Medium" },
  low: { badge: "bg-muted text-muted-foreground border-border", bar: "bg-muted-foreground", label: "Low" },
};
