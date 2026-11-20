/**
 * Momentum planning engine: ties priority scoring, the student's study
 * availability, calendar commitments and the scheduler together.
 * Pure functions over the workspace document so the app, browser tools and
 * MCP tools all get identical results.
 */
import type { Assignment, CalendarEvent, PriorityBreakdown, StudySession, Task } from "./types";
import { DEFAULT_WEIGHTS, computePriority, type PriorityWeights } from "./priority";
import { DEFAULT_PREFS, availableMinutes, busyIntervals, planSchedule, type SchedulePrefs } from "./schedule";

export interface ScheduleLogEntry {
  at: string;
  summary: string;
  changes: string[];
}

export interface Workspace {
  assignments: Assignment[];
  tasks: Task[];
  studySessions?: StudySession[];
  calendarEvents?: CalendarEvent[];
  availability?: SchedulePrefs;
  priorityWeights?: PriorityWeights;
  scheduleLog?: ScheduleLogEntry[];
}

export const prefsOf = (ws: Workspace): SchedulePrefs => ({ ...DEFAULT_PREFS, ...(ws.availability ?? {}) });
export const weightsOf = (ws: Workspace): PriorityWeights => ({ ...DEFAULT_WEIGHTS, ...(ws.priorityWeights ?? {}) });

const deadlineEnd = (a: Assignment) => new Date(`${a.deadline}T${a.deadlineTime ?? "23:59"}:00`);

/** Free study minutes before an assignment's deadline, after calendar events and other assignments' booked sessions. */
export function freeMinutesBefore(ws: Workspace, a: Assignment, now = new Date()) {
  const others = (ws.studySessions ?? []).filter((s) => s.assignmentId !== a.id);
  const busy = busyIntervals(ws.calendarEvents ?? [], others, prefsOf(ws).bufferMinutes);
  return availableMinutes(now, deadlineEnd(a), busy, prefsOf(ws));
}

export function priorityFor(ws: Workspace, a: Assignment, now = new Date()): PriorityBreakdown {
  const tasks = ws.tasks.filter((t) => t.assignmentId === a.id);
  return computePriority(a, tasks, now, { weights: weightsOf(ws), availableMinutes: freeMinutesBefore(ws, a, now) });
}

export function rankAssignments(ws: Workspace, now = new Date()) {
  return ws.assignments.map((a) => ({ a, p: priorityFor(ws, a, now) })).sort((x, y) => y.p.score - x.p.score);
}

/* ---------------- Falling-behind detection ---------------- */

export interface BehindReport {
  assignmentId: string;
  title: string;
  overdueTasks: Task[];
  missedSessions: StudySession[];
  shortfallMinutes: number;
  reasons: string[];
}

export function detectBehind(ws: Workspace, now = new Date()): BehindReport[] {
  const nowIso = now.toISOString();
  const today = toYmd(now);
  const done = new Set(ws.tasks.filter((t) => t.completed).map((t) => t.id));
  const preview = planSchedule(
    { tasks: ws.tasks, assignments: ws.assignments, priority: Object.fromEntries(rankAssignments(ws, now).map(({ a, p }) => [a.id, p.score])) },
    busyIntervals(ws.calendarEvents ?? [], [], prefsOf(ws).bufferMinutes),
    now,
    prefsOf(ws),
  );
  const out: BehindReport[] = [];
  for (const a of ws.assignments) {
    const tasks = ws.tasks.filter((t) => t.assignmentId === a.id);
    if (tasks.length && tasks.every((t) => t.completed)) continue;
    const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate < today);
    const missedSessions = (ws.studySessions ?? []).filter((s) => s.assignmentId === a.id && s.end < nowIso && s.taskId && !done.has(s.taskId));
    const shortfallMinutes = Math.round(preview.shortfall[a.id] ?? 0);
    const reasons: string[] = [];
    if (overdueTasks.length) reasons.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} past ${overdueTasks.length > 1 ? "their" : "its"} due date (${overdueTasks.slice(0, 2).map((t) => `“${t.title}”`).join(", ")}).`);
    if (missedSessions.length) reasons.push(`${missedSessions.length} planned study session${missedSessions.length > 1 ? "s were" : " was"} missed — the task${missedSessions.length > 1 ? "s are" : " is"} still unfinished.`);
    if (shortfallMinutes > 0) reasons.push(`About ${hours(shortfallMinutes)} of remaining work won't fit into your free study time before the deadline.`);
    if (reasons.length) out.push({ assignmentId: a.id, title: a.title, overdueTasks, missedSessions, shortfallMinutes, reasons });
  }
  return out;
}

/* ---------------- Automatic rescheduling ---------------- */

export interface RescheduleResult {
  sessions: StudySession[];
  removeIds: string[];
  taskUpdates: Task[];
  log: ScheduleLogEntry;
  shortfall: Record<string, number>;
}

/**
 * Rebuilds the schedule for all unfinished work across every assignment.
 * Keeps past sessions for finished tasks (history) and leaves completed tasks
 * untouched; drops missed and future sessions, re-plans around calendar
 * events and availability, moves overdue due dates to their new session day,
 * and records a plain-language explanation of every change.
 */
export function reschedule(ws: Workspace, now = new Date()): RescheduleResult {
  const nowIso = now.toISOString();
  const done = new Set(ws.tasks.filter((t) => t.completed).map((t) => t.id));
  const old = ws.studySessions ?? [];
  const keep = old.filter((s) => s.end <= nowIso && (!s.taskId || done.has(s.taskId)));
  const removeIds = old.filter((s) => !keep.includes(s)).map((s) => s.id);
  const prefs = prefsOf(ws);
  const ranked = rankAssignments(ws, now);
  const priority = Object.fromEntries(ranked.map(({ a, p }) => [a.id, p.score]));
  const events = ws.calendarEvents ?? [];
  const result = planSchedule({ tasks: ws.tasks, assignments: ws.assignments, priority }, busyIntervals(events, [], prefs.bufferMinutes), now, prefs);

  const today = toYmd(now);
  const byTask = new Map<string, StudySession[]>();
  result.sessions.forEach((s) => s.taskId && byTask.set(s.taskId, [...(byTask.get(s.taskId) ?? []), s]));
  const oldByTask = new Map<string, StudySession[]>();
  old.filter((s) => removeIds.includes(s.id)).forEach((s) => s.taskId && oldByTask.set(s.taskId, [...(oldByTask.get(s.taskId) ?? []), s]));

  const changes: string[] = [];
  const taskUpdates: Task[] = [];
  const titleOf = (id: string) => ws.assignments.find((a) => a.id === id)?.title ?? "assignment";

  for (const t of ws.tasks.filter((x) => !x.completed && x.estimatedMinutes > 0)) {
    const next = byTask.get(t.id) ?? [];
    const prev = oldByTask.get(t.id) ?? [];
    const missed = prev.filter((s) => s.end < nowIso);
    const clashed = prev.filter((s) => s.start >= nowIso && events.some((e) => !e.allDay && e.start < s.end && s.start < e.end));
    const firstNew = next[0] ? fmt(next[0].start) : null;
    const lastNewDay = next.length ? toYmd(new Date(next[next.length - 1].start)) : null;

    if (t.dueDate < today && lastNewDay) {
      taskUpdates.push({ ...t, dueDate: lastNewDay < t.dueDate ? t.dueDate : lastNewDay });
      changes.push(`“${t.title}” (${titleOf(t.assignmentId)}) was overdue — moved to ${firstNew}${missed.length ? " after a missed session" : ""}.`);
    } else if (missed.length && firstNew) {
      changes.push(`Missed session for “${t.title}” rebooked for ${firstNew}.`);
    } else if (clashed.length && firstNew) {
      changes.push(`“${t.title}” clashed with a calendar event — moved to ${firstNew}.`);
    } else if (!prev.length && firstNew) {
      changes.push(`“${t.title}” scheduled for ${firstNew} (${hours(t.estimatedMinutes)}).`);
    } else if (prev.length && firstNew && prev[0].start.slice(0, 16) !== next[0].start.slice(0, 16)) {
      changes.push(`“${t.title}” moved from ${fmt(prev[0].start)} to ${firstNew} to fit higher-priority work and your availability.`);
    }
    if (!next.length) changes.push(`No free time left for “${t.title}” before ${titleOf(t.assignmentId)} is due — reduce scope, extend your study hours or ask for an extension.`);
  }

  const top = ranked.find(({ a }) => ws.tasks.some((t) => t.assignmentId === a.id && !t.completed));
  const short = Object.values(result.shortfall).reduce((s, m) => s + m, 0);
  const summary = `${result.sessions.length} sessions planned across ${new Set(result.sessions.map((s) => s.assignmentId)).size} assignment(s)${top ? `; “${top.a.title}” gets first pick of time (priority ${top.p.score})` : ""}${short ? `; ${hours(short)} still doesn't fit` : ""}.`;

  return {
    sessions: result.sessions,
    removeIds,
    taskUpdates,
    shortfall: result.shortfall,
    log: { at: now.toISOString(), summary, changes: changes.length ? changes : ["Nothing needed to move — your schedule already fits."] },
  };
}

/* ---------------- helpers ---------------- */

export function toYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const hours = (m: number) => `${Math.round((m / 60) * 10) / 10}h`;
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
