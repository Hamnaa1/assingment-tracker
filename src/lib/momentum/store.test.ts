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
