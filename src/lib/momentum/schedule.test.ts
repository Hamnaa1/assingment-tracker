import { describe, expect, test } from "bun:test";
import { busyIntervals, findSlot, planSchedule, scheduleTasks } from "./schedule";
import { parseIcs } from "./ics";
import type { CalendarEvent, Task } from "./types";

const ev = (start: string, end: string): CalendarEvent => ({ id: start, feedId: "f", title: "Lecture", start: new Date(start).toISOString(), end: new Date(end).toISOString(), allDay: false });
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);

describe("study scheduling", () => {
  test("never books a study session over an existing calendar event", () => {
    const events = [ev("2026-12-01T09:00:00", "2026-12-01T12:00:00"), ev("2026-12-01T13:00:00", "2026-12-01T17:00:00")];
    const task: Task = { id: "t", assignmentId: "a", title: "Draft", description: "", estimatedMinutes: 240, startDate: "2026-12-01", dueDate: "2026-12-03", priority: "high", completed: false };
    const r = scheduleTasks([task], "2026-12-03", busyIntervals(events, []), new Date("2026-12-01T08:00:00"));
    expect(r.sessions.length).toBeGreaterThan(0);
    for (const s of r.sessions) for (const e of events) expect(overlaps(s, e)).toBe(false);
    expect(r.unscheduledMinutes).toBe(0);
  });

  test("completed tasks get no sessions", () => {
    const task: Task = { id: "t", assignmentId: "a", title: "Done", description: "", estimatedMinutes: 60, startDate: "2026-12-01", dueDate: "2026-12-02", priority: "low", completed: true };
    expect(scheduleTasks([task], "2026-12-02", [], new Date("2026-12-01T08:00:00")).sessions).toHaveLength(0);
  });

  test("reports work that doesn't fit before the deadline", () => {
    const events = [ev("2026-12-01T00:00:00", "2026-12-01T23:59:00")];
    const task: Task = { id: "t", assignmentId: "a", title: "Big", description: "", estimatedMinutes: 120, startDate: "2026-12-01", dueDate: "2026-12-01", priority: "high", completed: false };
    const r = scheduleTasks([task], "2026-12-01", busyIntervals(events, []), new Date("2026-12-01T08:00:00"));
    expect(r.unscheduledMinutes).toBe(120);
  });

  test("findSlot keeps a break after the previous event", () => {
    const slot = findSlot(60, new Date("2026-12-01T08:00:00"), new Date("2026-12-01T20:00:00"), busyIntervals([ev("2026-12-01T09:00:00", "2026-12-01T10:00:00")], [], 15));
    expect(new Date(slot!.start).getHours()).toBe(10);
    expect(new Date(slot!.start).getMinutes()).toBe(15);
  });
});

describe("calendar feed parsing", () => {
  test("expands a weekly lecture and skips excluded dates", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:lec", "SUMMARY:Lecture", "DTSTART:20261130T100000", "DTEND:20261130T120000", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4", "EXDATE:20261202T100000", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const out = parseIcs(ics, "f", new Date("2026-11-01"), new Date("2027-01-31"));
    expect(out.map((e) => new Date(e.start).getDate())).toEqual([30, 7, 9]);
  });
});

import { computePriority } from "./priority";
import { detectBehind, reschedule } from "./engine";
import type { Assignment } from "./types";

const asg = (over: Partial<Assignment> = {}): Assignment => ({ id: "a", title: "Essay", module: "M", deadline: "2026-12-10", weighting: 20, difficulty: 3, deliverables: [], rubric: [], sections: [], briefText: "", createdAt: "", ...over });
const task = (over: Partial<Task> = {}): Task => ({ id: "t", assignmentId: "a", title: "Draft", description: "", estimatedMinutes: 120, startDate: "2026-12-01", dueDate: "2026-12-05", priority: "medium", completed: false, ...over });
const NOW = new Date("2026-12-03T08:00:00");

describe("priority engine", () => {
  test("a closer deadline raises priority", () => {
    expect(computePriority(asg({ deadline: "2026-12-05" }), [task()], NOW).score).toBeGreaterThan(computePriority(asg({ deadline: "2026-12-20" }), [task()], NOW).score);
  });
  test("higher difficulty and grade weighting raise priority", () => {
    const base = computePriority(asg(), [task()], NOW).score;
    expect(computePriority(asg({ difficulty: 5 }), [task()], NOW).score).toBeGreaterThan(base);
    expect(computePriority(asg({ weighting: 50 }), [task()], NOW).score).toBeGreaterThan(base);
  });
  test("progress lowers priority", () => {
    const tasks = [task({ id: "1" }), task({ id: "2" })];
    expect(computePriority(asg(), [tasks[0], { ...tasks[1], completed: true }], NOW).score).toBeLessThan(computePriority(asg(), tasks, NOW).score);
  });
  test("less free time raises fall-behind risk", () => {
    expect(computePriority(asg(), [task()], NOW, { availableMinutes: 60 }).risk).toBe(100);
    expect(computePriority(asg(), [task()], NOW, { availableMinutes: 1200 }).risk).toBe(10);
  });
  test("custom weights change the score: urgency-only scores pure urgency", () => {
    const p = computePriority(asg({ deadline: "2026-12-03" }), [task()], NOW, { weights: { urgency: 1, workload: 0, importance: 0, difficulty: 0, risk: 0 } });
    expect(p.score).toBe(95);
  });
});

describe("availability, behind detection and rescheduling", () => {
  test("no sessions on days off or outside study hours, and daily cap respected", () => {
    const prefs = { days: [null, { start: 18, end: 21 }, null, { start: 18, end: 21 }, null, { start: 18, end: 21 }, null], bufferMinutes: 0, maxSessionMinutes: 120, maxDailyMinutes: 90 };
    const r = planSchedule({ tasks: [task({ estimatedMinutes: 240, dueDate: "2026-12-10" })], assignments: [asg()] }, [], NOW, prefs);
    for (const s of r.sessions) {
      const d = new Date(s.start);
      expect([1, 3, 5]).toContain(d.getDay());
      expect(d.getHours()).toBeGreaterThanOrEqual(18);
      expect((Date.parse(s.end) - Date.parse(s.start)) / 60000).toBeLessThanOrEqual(90);
    }
    expect(r.sessions.reduce((m, s) => m + (Date.parse(s.end) - Date.parse(s.start)) / 60000, 0)).toBe(240);
  });
  test("higher-priority assignment gets the earlier slot when due dates tie", () => {
    const ws = { assignments: [asg({ id: "low" }), asg({ id: "high" })], tasks: [task({ id: "l", assignmentId: "low" }), task({ id: "h", assignmentId: "high" })] };
    const r = planSchedule({ ...ws, priority: { low: 10, high: 90 } }, [], NOW);
    expect(r.sessions[0].assignmentId).toBe("high");
  });
  test("detects overdue tasks and missed sessions", () => {
    const ws = { assignments: [asg()], tasks: [task({ dueDate: "2026-12-01" })], studySessions: [{ id: "s", assignmentId: "a", taskId: "t", title: "Draft", start: "2026-12-02T10:00:00Z", end: "2026-12-02T12:00:00Z", reminderMinutes: 0 }] };
    const b = detectBehind(ws, NOW);
    expect(b[0].overdueTasks).toHaveLength(1);
    expect(b[0].missedSessions).toHaveLength(1);
  });
  test("reschedule rebooks missed work in the future, keeps completed tasks, and explains it", () => {
    const ws = { assignments: [asg()], tasks: [task({ dueDate: "2026-12-01" }), task({ id: "done", completed: true })], studySessions: [{ id: "s", assignmentId: "a", taskId: "t", title: "Draft", start: "2026-12-02T10:00:00Z", end: "2026-12-02T12:00:00Z", reminderMinutes: 0 }] };
    const r = reschedule(ws, NOW);
    expect(r.removeIds).toEqual(["s"]);
    expect(r.sessions.every((s) => Date.parse(s.start) >= NOW.getTime() && s.taskId === "t")).toBe(true);
    expect(r.taskUpdates[0].dueDate >= "2026-12-03").toBe(true);
    expect(r.log.changes[0]).toContain("overdue");
  });
});
