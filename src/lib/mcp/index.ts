import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAssignments from "./tools/list-assignments";
import listTasks from "./tools/list-tasks";
import setTaskCompleted from "./tools/set-task-completed";
import addTask from "./tools/add-task";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "assingment-tracker",
  title: "Assingment tracker",
  version: "0.1.0",
  instructions: "Momentum student planner. View the student's assignments (with priority scores) and planned tasks, add tasks, and mark tasks done.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAssignments, listTasks, setTaskCompleted, addTask],
});
