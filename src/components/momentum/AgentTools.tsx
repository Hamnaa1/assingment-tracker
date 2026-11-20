import { useWebMCP } from "use-webmcp-tool";
import { useMomentum } from "@/lib/momentum/store";
import { computePriority, completionPct } from "@/lib/momentum/priority";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

/** Browser-local tools for AI browsers while Momentum is open. */
export function AgentTools() {
  const { state, dispatch } = useMomentum();

  useWebMCP({
    name: "list_assignments",
    description: "List the student's assignments with deadline, priority score and progress.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool("list_assignments", () => {
        if (state.assignments.length === 0) return "No assignments.";
        return state.assignments
          .map((a) => {
            const tasks = state.tasks.filter((t) => t.assignmentId === a.id);
            const p = computePriority(a, tasks);
            return `${a.id}: ${a.title} (${a.module}) — due ${a.deadline.slice(0, 10)}, priority ${p.score} ${p.level}, ${completionPct(tasks)}% done`;
          })
          .join("\n");
      }),
  });

  useWebMCP({
    name: "list_tasks",
    description: "List tasks for one assignment, with IDs and completion status.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: { assignment_id: { type: "string", description: "Assignment ID from list_assignments." } },
      required: ["assignment_id"],
    },
    execute: ({ assignment_id }: { assignment_id: string }) =>
      runWebMCPTool("list_tasks", () => {
        if (typeof assignment_id !== "string" || !state.assignments.some((a) => a.id === assignment_id)) throw new Error("Unknown assignment_id.");
        const tasks = state.tasks.filter((t) => t.assignmentId === assignment_id);
        if (!tasks.length) return "No tasks.";
        return tasks.map((t) => `${t.id}: ${t.completed ? "[x]" : "[ ]"} ${t.title} — due ${t.dueDate.slice(0, 10)}`).join("\n");
      }),
  });

  useWebMCP({
    name: "set_task_completed",
    description: "Mark a task done or not done.",
    annotations: { untrustedContentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID from list_tasks." },
        completed: { type: "boolean", description: "true for done, false for not done." },
      },
      required: ["task_id", "completed"],
    },
    execute: ({ task_id, completed }: { task_id: string; completed: boolean }) =>
      runWebMCPTool("set_task_completed", () => {
        if (typeof completed !== "boolean") throw new Error("completed must be true or false.");
        const task = state.tasks.find((t) => t.id === task_id);
        if (!task) throw new Error("Unknown task_id.");
        dispatch({
          type: "updateTask",
          task: { ...task, completed, completedAt: completed ? task.completedAt ?? new Date().toISOString() : undefined },
        });
        return `Marked "${task.title}" ${completed ? "done" : "not done"}.`;
      }),
  });

  return null;
}
