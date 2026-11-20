import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadWorkspace, taskJson } from "../state";
import type { Task } from "../../momentum/types";

export default defineTool({
  name: "add_task",
  title: "Add task",
  description: "Add a task to an assignment's plan.",
  inputSchema: {
    assignment_id: z.string().describe("Assignment ID from list_assignments."),
    title: z.string().min(1).max(200).describe("Task title."),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Due date, YYYY-MM-DD."),
    estimated_minutes: z.number().int().min(5).max(1440).optional().describe("Estimated minutes (default 60)."),
    description: z.string().max(2000).optional().describe("Optional details."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ assignment_id, title, due_date, estimated_minutes, description }, ctx) => {
    const { ws, save } = await loadWorkspace(ctx);
    if (!ws.assignments.some((a) => a.id === assignment_id)) throw new ToolError("Unknown assignment_id.");
    if (Number.isNaN(Date.parse(due_date))) throw new ToolError("Invalid due_date.");
    const task: Task = {
      id: crypto.randomUUID(),
      assignmentId: assignment_id,
      title,
      description: description ?? "",
      estimatedMinutes: estimated_minutes ?? 60,
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: due_date,
      priority: "medium",
      completed: false,
    };
    ws.tasks.push(task);
    await save(ws);
    return { content: [{ type: "text", text: `Added "${title}" (id ${task.id}).` }], structuredContent: { task: taskJson(task) } };
  },
});
