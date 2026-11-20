import { describe, expect, test } from "bun:test";
import { applyPreset, dashboardOf, themeOf, moveWidget, visibleWidgets, withHabits } from "./dashboard";
import { DEFAULT_PREFS, planSchedule } from "./schedule";
import type { Task } from "./types";

const task = (min: number): Task => ({ id: "t", assignmentId: "a", title: "Essay", description: "", estimatedMinutes: min, startDate: "2026-12-01", dueDate: "2026-12-10", priority: "high", completed: false });
const plan = (prefs = DEFAULT_PREFS, min = 120) => planSchedule({ tasks: [task(min)], assignments: [{ id: "a", deadline: "2026-12-10" }] }, [], new Date("2026-12-01T07:00:00"), prefs);

describe("dashboard presets", () => {
  test("Focus preset uses 25-minute sessions with 5-minute breaks and minimal mode", () => {
    const r = applyPreset(dashboardOf(), "focus");
    expect(r.habits).toEqual({ sessionMinutes: 25, breakMinutes: 5 });
    expect(r.dashboard.mode).toBe("minimal");
    expect(visibleWidgets(r.dashboard)).toEqual(["risk", "dailyTasks", "priorities", "progress"]);
  });
  test("Balanced preset uses 50/10 and Detailed shows every widget with 90/15", () => {
    expect(applyPreset(dashboardOf(), "balanced").habits).toEqual({ sessionMinutes: 50, breakMinutes: 10 });
    const d = applyPreset(dashboardOf(), "detailed");
    expect(d.habits).toEqual({ sessionMinutes: 90, breakMinutes: 15 });
    expect(d.dashboard.hidden).toEqual([]);
  });
  test("rearranging swaps neighbours", () => {
    expect(moveWidget(["risk", "dailyTasks", "priorities"], "priorities", -1)).toEqual(["risk", "priorities", "dailyTasks"]);
  });
});

describe("study habits drive the scheduler", () => {
  test("session length caps every sitting", () => {
    const r = plan(withHabits(DEFAULT_PREFS, { sessionMinutes: 25, breakMinutes: 5, preferredTimes: [] }));
    expect(r.sessions.length).toBeGreaterThan(0);
    for (const s of r.sessions) expect((Date.parse(s.end) - Date.parse(s.start)) / 60000).toBeLessThanOrEqual(25);
  });
  test("evening preference schedules study at or after 17:00", () => {
    const r = plan(withHabits(DEFAULT_PREFS, { sessionMinutes: 60, breakMinutes: 10, preferredTimes: ["evening"] }), 60);
    expect(new Date(r.sessions[0].start).getHours()).toBeGreaterThanOrEqual(17);
  });
  test("without a preference the earliest free time is used", () => {
    expect(new Date(plan(DEFAULT_PREFS, 60).sessions[0].start).getHours()).toBe(9);
  });
});

describe("colour theme", () => {
  test("defaults to Lavender Purple and keeps a saved Sky Blue choice", () => {
    expect(dashboardOf().theme).toBe("lavender");
    expect(dashboardOf({ theme: "sky" }).theme).toBe("sky");
  });
  test("unknown saved themes fall back to the default", () => {
    expect(themeOf({ theme: "neon" as never })).toBe("lavender");
  });
  test("two students' themes are independent", () => {
    const a = dashboardOf({ theme: "sky" }), b = dashboardOf({});
    expect([a.theme, b.theme]).toEqual(["sky", "lavender"]);
  });
});
