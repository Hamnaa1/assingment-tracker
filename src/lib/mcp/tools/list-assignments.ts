import { priorityFor } from "../../momentum/engine";
import { defineTool } from "@lovable.dev/mcp-js";
import { loadWorkspace } from "../state";
import { computePriority, completionPct } from "../../momentum/priority";

export default defineTool({
  name: "list_assignments",
  title: "List assignments",
  description: "List the student's assignments with deadline, priority score (0-100) and progress, highest priority first.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { ws } = await loadWorkspace(ctx);
    const rows = ws.assignments
      .map((a) => {
        const tasks = ws.tasks.filter((t) => t.assignmentId === a.id);
        const p = priorityFor(ws as never, a);
        return { id: a.id, title: a.title, module: a.module, deadline: a.deadline, priorityScore: p.score, priorityLevel: p.level, percentComplete: completionPct(tasks), explanation: p.explanation };
      })
      .sort((x, y) => y.priorityScore - x.priorityScore);
    const text = rows.length ? rows.map((r) => `${r.id}: ${r.title} (${r.module}) — due ${r.deadline.slice(0, 10)}, priority ${r.priorityScore} ${r.priorityLevel}, ${r.percentComplete}% done`).join("\n") : "No assignments.";
    return { content: [{ type: "text", text }], structuredContent: { assignments: rows } };
  },
});
