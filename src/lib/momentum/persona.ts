/**
 * Student vs Professional personalisation. The persona only changes wording and
 * recommendations — both personas use the same workspace data and engines.
 */
export type Persona = "student" | "professional";
export type Struggle = "procrastination" | "overwhelm" | "distraction" | "time" | "starting";

export const STRUGGLES: Record<Struggle, { label: string; desc: string }> = {
  procrastination: { label: "Procrastination", desc: "Putting things off until the last minute" },
  overwhelm: { label: "Feeling overwhelmed", desc: "Too much on at once" },
  distraction: { label: "Getting distracted", desc: "Phone, tabs, notifications" },
  time: { label: "Time management", desc: "Underestimating how long things take" },
  starting: { label: "Starting tasks", desc: "Hard to get going" },
};

export interface Vocab {
  item: string; items: string; Item: string; Items: string;
  myItems: string; group: string; planner: string; plan: string;
  study: string; review: string; work: string; deadlineCtx: string; tagline: string;
}

export const VOCAB: Record<Persona, Vocab> = {
  student: {
    item: "assignment", items: "assignments", Item: "Assignment", Items: "Assignments",
    myItems: "My Assignments", group: "module", planner: "AI Planner", plan: "Study Plan",
    study: "study", review: "Assignment Review", work: "coursework", deadlineCtx: "module grade",
    tagline: "Plan smarter. Submit stronger.",
  },
  professional: {
    item: "project", items: "projects", Item: "Project", Items: "Projects",
    myItems: "My Projects", group: "workstream", planner: "AI Planner", plan: "Work Plan",
    study: "work", review: "Deliverable Review", work: "deliverables", deadlineCtx: "overall priorities",
    tagline: "Plan smarter. Deliver stronger.",
  },
};

export interface ProfileInfo {
  persona?: Persona;
  subject?: string; // course or subject (student)
  level?: string; // year/level (student, optional)
  role?: string; // job role or industry (professional, optional)
  struggles?: Struggle[];
}

export const personaOf = (p?: ProfileInfo) => p?.persona ?? "student";
export const vocabOf = (p?: ProfileInfo) => VOCAB[personaOf(p)];

/** Focus recommendation from the student's/professional's own struggles and session length. */
export function focusTip(p: ProfileInfo | undefined, sessionMinutes: number): string {
  const s = p?.struggles ?? [];
  const pro = personaOf(p) === "professional";
  if (s.includes("starting") || s.includes("procrastination"))
    return `Start with a 10-minute warm-up on the smallest ${pro ? "action item" : "task"} — getting going is the hardest part. Then move into your ${sessionMinutes}-minute session.`;
  if (s.includes("distraction"))
    return `Silence notifications and close unrelated tabs before your ${sessionMinutes}-minute session. Keep your phone out of reach.`;
  if (s.includes("overwhelm"))
    return `Pick just one ${pro ? "priority" : "task"} for this ${sessionMinutes}-minute session. Everything else can wait.`;
  if (s.includes("time"))
    return `Note how long this ${sessionMinutes}-minute session actually takes against your estimate — it sharpens future planning.`;
  return `Your ${sessionMinutes}-minute sessions work best with a clear single goal. ${pro ? "Block the time in your calendar." : "Put your phone away."}`;
}

/** Planner suggestion shown when adding new work. */
export function plannerTip(p: ProfileInfo | undefined): string {
  const s = p?.struggles ?? [];
  const pro = personaOf(p) === "professional";
  if (s.includes("overwhelm")) return pro ? "We'll break this project into small action items so it never feels like too much." : "We'll split this assignment into small steps so it never feels like too much.";
  if (s.includes("procrastination") || s.includes("starting")) return pro ? "Your first action item will be quick to start, so you build momentum early." : "Your first task will be quick to start, so you build momentum early.";
  if (s.includes("time")) return "Each step gets a time estimate — compare it with your real time to plan better.";
  return pro ? "Paste a project brief or spec and Momentum will turn it into prioritised action items." : "Paste an assignment brief and Momentum will turn it into a revision-ready plan.";
}

/** One-line progress summary in the right language. */
export function progressSummary(p: ProfileInfo | undefined, done: number, total: number, hours: number): string {
  const v = vocabOf(p);
  const pro = personaOf(p) === "professional";
  if (!total) return pro ? "No action items yet — add a project to get started." : "No tasks yet — add an assignment to get started.";
  return `${done} of ${total} ${pro ? "action items" : "tasks"} done and ${hours.toFixed(1)}h of focused ${v.study} logged.`;
}
