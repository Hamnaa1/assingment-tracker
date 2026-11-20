import { describe, expect, test } from "bun:test";
import { focusTip, vocabOf } from "./persona";

describe("persona", () => {
  test("students see assignments, professionals see projects", () => {
    expect(vocabOf({ persona: "student" }).Items).toBe("Assignments");
    expect(vocabOf({ persona: "professional" }).Items).toBe("Projects");
  });
  test("users without a saved role default to student wording", () => {
    expect(vocabOf(undefined).myItems).toBe("My Assignments");
  });
  test("focus tip uses the saved session length and struggles", () => {
    expect(focusTip({ struggles: ["distraction"] }, 45)).toContain("45-minute");
    expect(focusTip({ persona: "professional", struggles: ["overwhelm"] }, 25)).toContain("priority");
  });
});
