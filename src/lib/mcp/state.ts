import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import type { Assignment, Task } from "../momentum/types";

export interface Workspace {
  assignments: Assignment[];
  tasks: Task[];
  [key: string]: unknown;
}

export async function loadWorkspace(ctx: ToolContext) {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) throw new ToolError("Not signed in.");
  const db = supabaseForUser(ctx);
  const { data, error } = await db.from("momentum_state").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw new ToolError("Could not load your Momentum data.");
  const ws = data?.data as Workspace | undefined;
  if (!ws?.assignments) throw new ToolError("No Momentum workspace yet — open the app once to set it up.");
  ws.tasks ??= [];
  const save = async (next: Workspace) => {
    const { error: e } = await db.from("momentum_state").update({ data: next, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (e) throw new ToolError("Could not save your change.");
  };
  return { ws, save };
}

export const taskJson = (t: Task) => ({
  id: t.id,
  assignmentId: t.assignmentId,
  title: t.title,
  dueDate: t.dueDate,
  estimatedMinutes: t.estimatedMinutes,
  priority: t.priority,
  completed: t.completed,
});
