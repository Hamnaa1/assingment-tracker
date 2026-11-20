/** Turns real activity (focus sessions, completed tasks, XP history) into chart buckets. */
import type { FocusSession, Task } from "./types";

export type Range = "day" | "week" | "month";
export interface Bucket { key: string; label: string; start: number; end: number }

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function buckets(range: Range, now = new Date()): Bucket[] {
  const out: Bucket[] = [];
  if (range === "day") {
    for (let i = 13; i >= 0; i--) {
      const s = startOfDay(now); s.setDate(s.getDate() - i);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      out.push({ key: s.toISOString(), label: s.toLocaleDateString(undefined, { day: "numeric", month: "short" }), start: s.getTime(), end: e.getTime() });
    }
  } else if (range === "week") {
    const monday = startOfDay(now); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const s = new Date(monday); s.setDate(s.getDate() - i * 7);
      const e = new Date(s); e.setDate(e.getDate() + 7);
      out.push({ key: s.toISOString(), label: `w/c ${s.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, start: s.getTime(), end: e.getTime() });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ key: s.toISOString(), label: s.toLocaleDateString(undefined, { month: "short" }), start: s.getTime(), end: e.getTime() });
    }
  }
  return out;
}

export const focusMinutes = (s: FocusSession) => s.activeMinutes ?? s.actualMinutes;

export function sumInto<T>(bs: Bucket[], items: T[], at: (t: T) => string | undefined, value: (t: T) => number) {
  return bs.map((b) => ({
    label: b.label,
    value: items.reduce((sum, it) => { const iso = at(it); const t = iso ? Date.parse(iso) : NaN; return t >= b.start && t < b.end ? sum + value(it) : sum; }, 0),
  }));
}

export const focusSeries = (bs: Bucket[], sessions: FocusSession[]) => sumInto(bs, sessions, (s) => s.endedAt, focusMinutes);
export const taskSeries = (bs: Bucket[], tasks: Task[]) => sumInto(bs, tasks.filter((t) => t.completed), (t) => t.completedAt, () => 1);

/** Activity count per calendar day for the consistency heatmap (last `weeks` weeks). */
export function heatmap(sessions: FocusSession[], tasks: Task[], weeks = 12, now = new Date()) {
  const end = startOfDay(now);
  const start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1));
  const counts = new Map<string, number>();
  const add = (iso?: string) => { if (!iso) return; const k = startOfDay(new Date(iso)).toDateString(); counts.set(k, (counts.get(k) ?? 0) + 1); };
  sessions.forEach((s) => add(s.endedAt));
  tasks.filter((t) => t.completed).forEach((t) => add(t.completedAt));
  const days: { date: Date; count: number }[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push({ date: new Date(d), count: counts.get(d.toDateString()) ?? 0 });
  return days;
}
