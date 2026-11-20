import { describe, expect, test } from "bun:test";
import { busyIntervals, findSlot, scheduleTasks } from "./schedule";
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
