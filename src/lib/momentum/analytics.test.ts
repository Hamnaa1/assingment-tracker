import { describe, expect, it } from "vitest";
import { buckets, focusSeries, taskSeries } from "./analytics";
import type { FocusSession, Task } from "./types";

const now = new Date("2026-11-20T12:00:00");
const session = (endedAt: string, mins: number, active?: number): FocusSession => ({ id: endedAt, plannedMinutes: 60, actualMinutes: mins, activeMinutes: active, startedAt: endedAt, endedAt, completed: true });

describe("analytics", () => {
  it("sums real focus minutes per day, preferring active (unpaused) minutes", () => {
    const series = focusSeries(buckets("day", now), [session("2026-11-20T10:00:00", 50, 40), session("2026-11-19T10:00:00", 25)]);
    expect(series.at(-1)!.value).toBe(40);
    expect(series.at(-2)!.value).toBe(25);
    expect(series.length).toBe(14);
  });
  it("counts only completed tasks", () => {
    const tasks = [{ completed: true, completedAt: "2026-11-20T09:00:00" }, { completed: false }] as Task[];
    expect(taskSeries(buckets("week", now), tasks).at(-1)!.value).toBe(1);
  });
});
