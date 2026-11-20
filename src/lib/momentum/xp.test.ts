import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, levelFor, rankBoard, type BoardRow } from "./xp";

const row = (id: string, xp: number, extra: Partial<BoardRow> = {}): BoardRow => ({ user_id: id, display_name: id, avatar: "🎓", is_me: false, opted_in: true, total_xp: xp, period_xp: xp, focus_minutes: 0, tasks: 0, goal_days: 0, streak: 0, ...extra });

describe("XP rewards", () => {
  it("uses the agreed reward values", () => {
    expect(DEFAULT_REWARDS.focus_minute.amount).toBe(1);
    expect(DEFAULT_REWARDS.task_complete.amount).toBe(30);
    expect(DEFAULT_REWARDS.daily_goal.amount).toBe(50);
    expect(DEFAULT_REWARDS.on_time_submission.amount).toBe(100);
    expect(DEFAULT_REWARDS.streak_7.amount).toBe(150);
  });
});

describe("levels", () => {
  it("starts at level 1 Getting Started", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: "Getting Started", toNext: 100 });
  });
  it("levels up exactly at a threshold", () => {
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(250)).toMatchObject({ level: 3, title: "Focus Builder" });
  });
});

describe("leaderboard ranking", () => {
  it("orders by weekly XP, hides opted-out friends but keeps yourself", () => {
    const ranked = rankBoard([row("a", 50), row("b", 200), row("c", 500, { opted_in: false }), row("me", 120, { is_me: true, opted_in: false })], "xp", 7);
    expect(ranked.map((r) => r.user_id)).toEqual(["b", "me", "a"]);
    expect(ranked[1].rank).toBe(2);
  });
  it("ranks consistency by share of days the personal goal was met", () => {
    const ranked = rankBoard([row("a", 0, { goal_days: 2 }), row("b", 900, { goal_days: 5 })], "consistency", 7);
    expect(ranked[0].user_id).toBe("b");
    expect(ranked[0].value).toBe(71);
  });
});
