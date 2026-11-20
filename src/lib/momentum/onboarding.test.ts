import { describe, expect, test } from "bun:test";
import { defaultAnswers, needsOnboarding, profileFromAnswers, withFocusSupport } from "./onboarding";
import { visibleWidgets } from "./dashboard";
import { DEFAULT_PREFS, planSchedule } from "./schedule";
import type { Task } from "./types";

const task: Task = { id: "t", assignmentId: "a", title: "Essay", description: "", estimatedMinutes: 180, startDate: "2026-12-01", dueDate: "2026-12-10", priority: "high", completed: false };
const plan = (prefs: typeof DEFAULT_PREFS) => planSchedule({ tasks: [task], assignments: [{ id: "a", deadline: "2026-12-10" }] }, [], new Date("2026-12-01T07:00:00"), prefs);

const focused = withFocusSupport({ ...defaultAnswers(), theme: "sky", preferredTimes: ["morning"] });
const deep = { ...defaultAnswers(), days: defaultAnswers().days.map((d) => d && { start: 9, end: 22 }), sessionMinutes: 90, breakMinutes: 15, taskStyle: "long" as const, layout: "detailed" as const, preferredTimes: ["evening" as const] };

describe("Make Momentum Yours", () => {
  test("concentration support gives 25-minute sessions, 5-minute breaks and the Focus dashboard", () => {
    const p = profileFromAnswers(focused, undefined, DEFAULT_PREFS);
    expect(p.availability.maxSessionMinutes).toBe(25);
    expect(p.availability.bufferMinutes).toBe(5);
    expect(p.dashboard.mode).toBe("minimal");
    expect(p.dashboard.theme).toBe("sky");
  });
  test("smaller tasks cap sittings at 30 minutes", () => {
    expect(profileFromAnswers({ ...deep, taskStyle: "small" }, undefined, DEFAULT_PREFS).availability.maxSessionMinutes).toBe(30);
  });
  test("different students get different dashboards and schedules", () => {
    const a = profileFromAnswers(focused, undefined, DEFAULT_PREFS), b = profileFromAnswers(deep, undefined, DEFAULT_PREFS);
    expect(visibleWidgets(a.dashboard)).not.toEqual(visibleWidgets(b.dashboard));
    const sa = plan(a.availability).sessions, sb = plan(b.availability).sessions;
    expect(Math.max(...sa.map((s) => (Date.parse(s.end) - Date.parse(s.start)) / 60000))).toBeLessThanOrEqual(25);
    expect(Math.max(...sb.map((s) => (Date.parse(s.end) - Date.parse(s.start)) / 60000))).toBeGreaterThan(25);
    expect(new Date(sa[0].start).getHours()).toBeLessThan(12);
    expect(new Date(sb[0].start).getHours()).toBeGreaterThanOrEqual(17);
  });
  test("weekends off means nothing is scheduled on Saturday or Sunday", () => {
    const p = profileFromAnswers(deep, undefined, DEFAULT_PREFS);
    expect(plan(p.availability).sessions.every((s) => ![0, 6].includes(new Date(s.start).getDay()))).toBe(true);
  });
  test("only brand-new students are sent to onboarding automatically", () => {
    expect(needsOnboarding({})).toBe(true);
    expect(needsOnboarding({ dashboard: {} })).toBe(false);
    expect(needsOnboarding({ onboarding: { status: "skipped", at: "" } })).toBe(false);
  });
});
