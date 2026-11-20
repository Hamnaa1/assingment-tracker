import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadWorkspace, taskJson } from "../state";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description: "List planned tasks, optionally for one assignment and/or only incomplete ones, ordered by due date.",
  inputSchema: {
    assignment_id: z.string().optional().describe("Assignment ID from list_assignments; omit for all assignments."),
    only_open: z.boolean().optional().describe("If true, only return tasks not yet completed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ assignment_id, only_open }, ctx) => {
    const { ws } = await loadWorkspace(ctx);
    if (assignment_id && !ws.assignments.some((a) => a.id === assignment_id)) throw new ToolError("Unknown assignment_id.");
    const tasks = ws.tasks
      .filter((t) => (!assignment_id || t.assignmentId === assignment_id) && (!only_open || !t.completed))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(taskJson);
    const text = tasks.length ? tasks.map((t) => `${t.id}: ${t.completed ? "[x]" : "[ ]"} ${t.title} — due ${t.dueDate.slice(0, 10)}`).join("\n") : "No tasks.";
    return { content: [{ type: "text", text }], structuredContent: { tasks } };
  },
});
