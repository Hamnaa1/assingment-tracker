import type { Assignment, CalendarEvent, StudySession, Task } from "./types";

export interface Interval { start: number; end: number }

/** One weekday's study window in local hours (e.g. 9.5 = 09:30). null = no study that day. */
export interface DayWindow { start: number; end: number }

export interface SchedulePrefs {
  days: (DayWindow | null)[]; // index 0 = Sunday … 6 = Saturday
  bufferMinutes: number; // break around every busy block and between sessions
  maxSessionMinutes: number; // longest single sitting
  maxDailyMinutes: number; // most study the student wants per day
}

export const DEFAULT_PREFS: SchedulePrefs = {
  days: Array.from({ length: 7 }, () => ({ start: 9, end: 21 })),
  bufferMinutes: 15,
  maxSessionMinutes: 120,
  maxDailyMinutes: 360,
};

const MIN = 60000;
const uid = () => Math.random().toString(36).slice(2, 10);
const dayKey = (t: number) => new Date(t).toDateString();

function windowFor(day: Date, prefs: SchedulePrefs): { start: number; end: number } | null {
  const w = prefs.days[day.getDay()];
  if (!w || w.end <= w.start) return null;
  const s = new Date(day); s.setHours(Math.floor(w.start), Math.round((w.start % 1) * 60), 0, 0);
  const e = new Date(day); e.setHours(Math.floor(w.end), Math.round((w.end % 1) * 60), 0, 0);
  return { start: s.getTime(), end: e.getTime() };
}

/** Busy blocks from calendar events and already-scheduled sessions (all-day events are not treated as busy). */
export function busyIntervals(events: CalendarEvent[], sessions: StudySession[], bufferMinutes = 0): Interval[] {
  const pad = bufferMinutes * MIN;
  return [
    ...events.filter((e) => !e.allDay).map((e) => ({ start: Date.parse(e.start) - pad, end: Date.parse(e.end) + pad })),
    ...sessions.map((s) => ({ start: Date.parse(s.start) - pad, end: Date.parse(s.end) + pad })),
  ].sort((a, b) => a.start - b.start);
}

/** Free windows inside the student's availability between `from` and `to`. */
export function freeWindows(from: Date, to: Date, busy: Interval[], prefs: SchedulePrefs = DEFAULT_PREFS): Interval[] {
  const out: Interval[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day.getTime() < to.getTime()) {
    const w = windowFor(day, prefs);
    if (w) {
      let cursor = Math.max(w.start, from.getTime());
      const end = Math.min(w.end, to.getTime());
      for (const b of busy) {
        if (b.end <= cursor || b.start >= end) continue;
        if (b.start > cursor) out.push({ start: cursor, end: b.start });
        cursor = Math.max(cursor, b.end);
      }
      if (cursor < end) out.push({ start: cursor, end });
    }
    day.setDate(day.getDate() + 1);
  }
  return out.filter((w) => w.end - w.start >= 15 * MIN);
}

/** Free study minutes before `to`, respecting the daily cap. */
export function availableMinutes(from: Date, to: Date, busy: Interval[], prefs: SchedulePrefs = DEFAULT_PREFS) {
  const perDay = new Map<string, number>();
  for (const w of freeWindows(from, to, busy, prefs)) perDay.set(dayKey(w.start), (perDay.get(dayKey(w.start)) ?? 0) + (w.end - w.start) / MIN);
  let total = 0;
  perDay.forEach((m) => (total += Math.min(m, prefs.maxDailyMinutes)));
  return Math.round(total);
}

/** Earliest free slot of `minutes` length (quarter-hour aligned), skipping days already at the daily cap. */
export function findSlot(
  minutes: number,
  from: Date,
  to: Date,
  busy: Interval[],
  prefs: SchedulePrefs = DEFAULT_PREFS,
  usedPerDay?: Map<string, number>,
): Interval | null {
  const q = 15 * MIN;
  for (const w of freeWindows(from, to, busy, prefs)) {
    if (usedPerDay && (usedPerDay.get(dayKey(w.start)) ?? 0) + minutes > prefs.maxDailyMinutes) continue;
    const start = Math.ceil(w.start / q) * q;
    if (start + minutes * MIN <= w.end) return { start, end: start + minutes * MIN };
  }
  return null;
}

export interface ScheduleResult {
  sessions: StudySession[];
  unscheduledMinutes: number;
  neededMinutes: number;
  availableMinutes: number;
  /** Minutes that could not be placed, per assignment. */
  shortfall: Record<string, number>;
}

export interface PlanInput {
  tasks: Task[];
  assignments: Pick<Assignment, "id" | "deadline">[];
  /** Higher = schedule first when tasks compete for the same time. */
  priority?: Record<string, number>;
}

/**
 * Multi-assignment scheduler. Orders unfinished tasks by due date, then by
 * assignment priority, and places each into the earliest free study time
 * before it is due (falling back to any time before the assignment deadline).
 * Work is split into sittings ≤ maxSessionMinutes, at most one sitting per
 * task per day, never over busy time, and never past the daily cap.
 */
export function planSchedule(input: PlanInput, busy: Interval[], now = new Date(), prefs: SchedulePrefs = DEFAULT_PREFS): ScheduleResult {
  const deadlines = new Map(input.assignments.map((a) => [a.id, new Date(a.deadline + "T23:59:00")]));
  const prio = input.priority ?? {};
  const pending = input.tasks
    .filter((t) => !t.completed && t.estimatedMinutes > 0 && deadlines.has(t.assignmentId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (prio[b.assignmentId] ?? 0) - (prio[a.assignmentId] ?? 0));
  const blocks = [...busy];
  const used = new Map<string, number>();
  const sessions: StudySession[] = [];
  const shortfall: Record<string, number> = {};
  const lastDeadline = new Date(Math.max(now.getTime(), ...[...deadlines.values()].map((d) => d.getTime())));
  const avail = availableMinutes(now, lastDeadline, busy, prefs);

  for (const t of pending) {
    let left = t.estimatedMinutes;
    const deadline = deadlines.get(t.assignmentId)!;
    const due = new Date(Math.min(new Date(t.dueDate + "T23:59:00").getTime(), deadline.getTime()));
    let from = new Date(Math.max(now.getTime(), new Date(t.startDate + "T00:00:00").getTime()));
    if (from >= due) from = now;
    let tries = 0;
    while (left > 0 && tries++ < 80) {
      const len = Math.min(left, prefs.maxSessionMinutes);
      let slot = findSlot(len, from, due, blocks, prefs, used);
      if (!slot && from > now) slot = findSlot(len, now, due, blocks, prefs, used);
      if (!slot) slot = findSlot(len, now, deadline, blocks, prefs, used);
      if (!slot && len > 30) {
        // Try a shorter sitting before giving up.
        const short = findSlot(30, now, deadline, blocks, prefs, used);
        if (short) slot = short;
      }
      if (!slot) break;
      const mins = (slot.end - slot.start) / MIN;
      sessions.push({ id: uid(), assignmentId: t.assignmentId, taskId: t.id, title: t.title, start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString(), reminderMinutes: 15 });
      blocks.push({ start: slot.start - prefs.bufferMinutes * MIN, end: slot.end + prefs.bufferMinutes * MIN });
      blocks.sort((a, b) => a.start - b.start);
      used.set(dayKey(slot.start), (used.get(dayKey(slot.start)) ?? 0) + mins);
      left -= mins;
      const next = new Date(slot.start); next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0);
      from = next < due ? next : new Date(slot.end);
    }
    if (left > 0) shortfall[t.assignmentId] = (shortfall[t.assignmentId] ?? 0) + left;
  }
  const unscheduled = Object.values(shortfall).reduce((s, m) => s + m, 0);
  return { sessions, unscheduledMinutes: unscheduled, neededMinutes: pending.reduce((s, t) => s + t.estimatedMinutes, 0), availableMinutes: avail, shortfall };
}

/** Single-assignment convenience wrapper (used on the assignment page). */
export function scheduleTasks(tasks: Task[], deadline: string, busy: Interval[], now = new Date(), prefs: SchedulePrefs = DEFAULT_PREFS): ScheduleResult {
  const id = tasks[0]?.assignmentId ?? "_";
  return planSchedule({ tasks, assignments: [{ id, deadline }] }, busy, now, prefs);
}
