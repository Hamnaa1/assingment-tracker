import { describe, expect, test } from "bun:test";
import { fresh, momentumReducer } from "./store";

describe("deleting an assignment", () => {
  test("removes it, its tasks and its sessions; keeps others and focus history", () => {
    const s = { ...fresh(),
      assignments: [{ id: "a" }, { id: "b" }] as never,
      tasks: [{ id: "t1", assignmentId: "a" }, { id: "t2", assignmentId: "b" }] as never,
      studySessions: [{ id: "s1", assignmentId: "a" }, { id: "s2", assignmentId: "b" }] as never,
      sessions: [{ id: "f1", assignmentId: "a" }] as never };
    const n = momentumReducer(s, { type: "deleteAssignment", id: "a" });
    expect(n.assignments.map((a) => a.id)).toEqual(["b"]);
    expect(n.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect((n.studySessions ?? []).map((x) => x.id)).toEqual(["s2"]);
    expect(n.sessions.length).toBe(1);
  });
  test("new accounts start with no example assignments", () => {
    expect(fresh().assignments.length).toBe(0);
  });
});

describe("task management", () => {
  const base = () => ({ ...fresh(),
    assignments: [{ id: "a", deadline: "2099-01-10" }] as never,
    tasks: [{ id: "t1", assignmentId: "a", title: "Draft intro", completed: false }] as never,
    studySessions: [
      { id: "s1", assignmentId: "a", taskId: "t1", start: "2099-01-05T10:00" },
      { id: "s2", assignmentId: "a", taskId: "t1", start: "2099-01-20T10:00" },
      { id: "s3", assignmentId: "a", taskId: "t1", start: "2099-01-21T10:00", locked: true },
    ] as never });
  test("adding a task with the same title twice is ignored", () => {
    const n = momentumReducer(base(), { type: "addTask", task: { id: "t2", assignmentId: "a", title: " draft INTRO " } as never });
    expect(n.tasks.length).toBe(1);
  });
  test("completing a task removes its upcoming unlocked sessions; reopening keeps one task", () => {
    const n = momentumReducer(base(), { type: "toggleTask", id: "t1" });
    expect((n.studySessions ?? []).map((s) => s.id)).toEqual(["s3"]);
    const r = momentumReducer(n, { type: "toggleTask", id: "t1" });
    expect(r.tasks.length).toBe(1);
    expect(r.tasks[0].completed).toBe(false);
  });
  test("moving a deadline earlier drops unlocked sessions after it", () => {
    const n = momentumReducer(base(), { type: "updateAssignment", assignment: { id: "a", deadline: "2099-01-10" } as never });
    expect((n.studySessions ?? []).map((s) => s.id)).toEqual(["s1", "s3"]);
  });
});
