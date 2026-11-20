import type { CalendarEvent, StudySession, Task } from "./types";

export interface Interval { start: number; end: number }

export interface SchedulePrefs {
  dayStartHour: number; // earliest study start
  dayEndHour: number; // latest study end
  bufferMinutes: number; // break around every busy block
  maxSessionMinutes: number; // longest single sitting
}

export const DEFAULT_PREFS: SchedulePrefs = { dayStartHour: 9, dayEndHour: 21, bufferMinutes: 15, maxSessionMinutes: 120 };

const MIN = 60000;
const uid = () => Math.random().toString(36).slice(2, 10);

/** Busy blocks from calendar events and already-scheduled sessions (all-day events are not treated as busy). */
export function busyIntervals(events: CalendarEvent[], sessions: StudySession[], bufferMinutes = 0): Interval[] {
  const pad = bufferMinutes * MIN;
  return [
    ...events.filter((e) => !e.allDay).map((e) => ({ start: Date.parse(e.start) - pad, end: Date.parse(e.end) + pad })),
    ...sessions.map((s) => ({ start: Date.parse(s.start) - pad, end: Date.parse(s.end) + pad })),
  ].sort((a, b) => a.start - b.start);
}

/** Free windows within study hours between `from` and `to`. */
export function freeWindows(from: Date, to: Date, busy: Interval[], prefs: SchedulePrefs = DEFAULT_PREFS): Interval[] {
  const out: Interval[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day.getTime() < to.getTime()) {
    const ds = new Date(day); ds.setHours(prefs.dayStartHour, 0, 0, 0);
    const de = new Date(day); de.setHours(prefs.dayEndHour, 0, 0, 0);
    let cursor = Math.max(ds.getTime(), from.getTime());
    const end = Math.min(de.getTime(), to.getTime());
    for (const b of busy) {
      if (b.end <= cursor || b.start >= end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < end) out.push({ start: cursor, end });
    day.setDate(day.getDate() + 1);
  }
  return out.filter((w) => w.end - w.start >= 15 * MIN);
}

export function availableMinutes(from: Date, to: Date, busy: Interval[], prefs: SchedulePrefs = DEFAULT_PREFS) {
  return Math.round(freeWindows(from, to, busy, prefs).reduce((s, w) => s + (w.end - w.start), 0) / MIN);
}

/** Earliest free slot of `minutes` length, rounded up to the next quarter hour. */
export function findSlot(minutes: number, from: Date, to: Date, busy: Interval[], prefs: SchedulePrefs = DEFAULT_PREFS): Interval | null {
  const q = 15 * MIN;
  for (const w of freeWindows(from, to, busy, prefs)) {
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
}

/**
 * Places every incomplete task's work into free calendar time before its due
 * date (or the deadline), in due-date order, split into sittings no longer
 * than maxSessionMinutes and spread so at most one sitting per task per day.
 */
export function scheduleTasks(
  tasks: Task[],
  deadline: string,
  busy: Interval[],
  now = new Date(),
  prefs: SchedulePrefs = DEFAULT_PREFS,
): ScheduleResult {
  const deadlineEnd = new Date(deadline + "T23:59:00");
  const pending = tasks.filter((t) => !t.completed && t.estimatedMinutes > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const blocks = [...busy];
  const sessions: StudySession[] = [];
  let unscheduled = 0;
  const neededMinutes = pending.reduce((s, t) => s + t.estimatedMinutes, 0);
  const avail = availableMinutes(now, deadlineEnd, busy.map((b) => ({ ...b })), prefs);

  for (const t of pending) {
    let left = t.estimatedMinutes;
    const due = new Date(Math.min(new Date(t.dueDate + "T23:59:00").getTime(), deadlineEnd.getTime()));
    let from = new Date(Math.max(now.getTime(), new Date(t.startDate + "T00:00:00").getTime()));
    if (from >= due) from = now;
    let tries = 0;
    while (left > 0 && tries++ < 60) {
      const len = Math.min(left, prefs.maxSessionMinutes);
      let slot = findSlot(len, from, due, blocks, prefs);
      if (!slot) slot = findSlot(len, now, deadlineEnd, blocks, prefs); // fall back to any time before the deadline
      if (!slot) break;
      sessions.push({ id: uid(), assignmentId: t.assignmentId, taskId: t.id, title: t.title, start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString(), reminderMinutes: 15 });
      blocks.push({ start: slot.start - prefs.bufferMinutes * MIN, end: slot.end + prefs.bufferMinutes * MIN });
      blocks.sort((a, b) => a.start - b.start);
      left -= len;
      const next = new Date(slot.start); next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0);
      from = next < due ? next : new Date(slot.end);
    }
    unscheduled += Math.max(0, left);
  }
  return { sessions, unscheduledMinutes: unscheduled, neededMinutes, availableMinutes: avail };
}
