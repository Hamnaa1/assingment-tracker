import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { loadWorkspace, taskJson } from "../state";

export default defineTool({
  name: "set_task_completed",
  title: "Mark task done / not done",
  description: "Set whether a task is completed.",
  inputSchema: {
    task_id: z.string().describe("Task ID from list_tasks."),
    completed: z.boolean().describe("true = done, false = not done."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, completed }, ctx) => {
    const { ws, save } = await loadWorkspace(ctx);
    const task = ws.tasks.find((t) => t.id === task_id);
    if (!task) throw new ToolError("Unknown task_id.");
    task.completed = completed;
    task.completedAt = completed ? task.completedAt ?? new Date().toISOString() : undefined;
    await save(ws);
    return { content: [{ type: "text", text: `Marked "${task.title}" ${completed ? "done" : "not done"}.` }], structuredContent: { task: taskJson(task) } };
  },
});
