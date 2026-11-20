import { supabase } from "@/integrations/supabase/client";
import { analyzeBrief, ASSIGNMENT_TYPES, generatePlan, reviewWork, type BriefAnalysis } from "./ai";
import { daysUntil } from "./priority";
import type { Assignment, PriorityLevel, ReviewResult, RubricCriterion, Task } from "./types";

/** "ai" = real LLM result; "fallback" = local heuristics (offline, signed out, or AI error). */
export type AiSource = "ai" | "fallback";
export interface AiOutcome<T> {
  data: T;
  source: AiSource;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const LEVELS: PriorityLevel[] = ["low", "medium", "high", "critical"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const str = (v: unknown, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const strList = (v: unknown, max = 12) =>
  Array.isArray(v) ? v.map((x) => str(x, 300)).filter((x): x is string => !!x).slice(0, max) : [];
const level = (v: unknown, dflt: PriorityLevel = "medium"): PriorityLevel => (LEVELS.includes(v as PriorityLevel) ? (v as PriorityLevel) : dflt);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

async function callAi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("momentum-ai", { body });
  if (error) throw error;
  if (!data?.data || typeof data.data !== "object") throw new Error("Empty AI response");
  return data.data as Record<string, unknown>;
}

function assignmentPayload(a: Assignment) {
  const { id: _id, createdAt: _c, ...rest } = a;
  return rest;
}

/** Real-LLM brief analysis; any missing/invalid field is filled from the heuristic extractor. */
export async function analyzeBriefAI(text: string): Promise<AiOutcome<BriefAnalysis>> {
  const local = analyzeBrief(text);
  try {
    const r = await callAi({ action: "analyzeBrief", text, today: isoDay(new Date()) });
    const deadline = str(r.deadline, 10);
    const time = str(r.deadlineTime, 5);
    const rubric: RubricCriterion[] = Array.isArray(r.rubric)
      ? r.rubric
          .map((c: { criterion?: unknown; weight?: unknown }) => ({ criterion: str(c?.criterion, 120) ?? "", weight: clamp(Math.round(num(c?.weight) ?? 0), 0, 100) }))
          .filter((c) => c.criterion && c.weight > 0)
          .slice(0, 10)
      : [];
    const sections = strList(r.sections, 10);
    const deliverables = strList(r.deliverables, 10);
    const type = str(r.type, 40);
    const data: BriefAnalysis = {
      title: str(r.title, 90) ?? local.title,
      module: str(r.module, 60) ?? local.module,
      deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && !isNaN(Date.parse(deadline)) ? deadline : local.deadline,
      deadlineTime: time && /^\d{2}:\d{2}$/.test(time) ? time : local.deadlineTime,
      wordCount: num(r.wordCount) ? Math.round(num(r.wordCount)!) : local.wordCount,
      weighting: num(r.weighting) !== undefined ? clamp(Math.round(num(r.weighting)!), 0, 100) : local.weighting,
      difficulty: clamp(Math.round(num(r.difficulty) ?? local.difficulty), 1, 5) as BriefAnalysis["difficulty"],
      type: type && ASSIGNMENT_TYPES.includes(type) ? type : local.type,
      description: str(r.description, 400) ?? local.description,
      deliverables: deliverables.length ? deliverables : local.deliverables,
      sections: sections.length ? sections : local.sections,
      rubric: rubric.length ? rubric : local.rubric,
      referencingStyle: str(r.referencingStyle, 40) ?? local.referencingStyle,
      instructions: str(r.instructions, 300) ?? local.instructions,
      learningOutcomes: strList(r.learningOutcomes, 8).length ? strList(r.learningOutcomes, 8) : local.learningOutcomes,
      assessmentCriteria: strList(r.assessmentCriteria, 8).length ? strList(r.assessmentCriteria, 8) : local.assessmentCriteria,
      submissionFormat: str(r.submissionFormat, 80) ?? local.submissionFormat,
    };
    return { data, source: "ai" };
  } catch (e) {
    console.warn("AI brief analysis failed, using local fallback", e);
    return { data: local, source: "fallback" };
  }
}

/** Real-LLM plan; dates are computed here from day offsets so they always fit before the deadline. */
export async function generatePlanAI(assignment: Assignment): Promise<AiOutcome<Task[]>> {
  try {
    const now = new Date();
    const days = Math.max(daysUntil(assignment.deadline, now), 1);
    const r = await callAi({ action: "generatePlan", assignment: assignmentPayload(assignment), today: isoDay(now), daysUntilDeadline: days });
    const raw = Array.isArray(r.tasks) ? r.tasks : [];
    const tasks: Task[] = raw
      .map((t: Record<string, unknown>): Task | null => {
        const title = str(t?.title, 90);
        if (!title) return null;
        const offset = clamp(Math.round(num(t.dayOffset) ?? 0), 0, days - 1);
        const start = new Date(now.getTime() + offset * 86400000);
        return {
          id: uid(),
          assignmentId: assignment.id,
          title,
          description: str(t.description, 500) ?? "",
          estimatedMinutes: clamp(Math.round(num(t.estimatedMinutes) ?? 60), 0, 600),
          startDate: isoDay(start),
          dueDate: isoDay(new Date(start.getTime() + 86400000)),
          priority: level(t.priority),
          completed: false,
          milestone: t.milestone === true,
        };
      })
      .filter((t): t is Task => !!t)
      .slice(0, 20);
    if (tasks.length < 3) throw new Error("AI plan too short");
    tasks.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { data: tasks, source: "ai" };
  } catch (e) {
    console.warn("AI plan generation failed, using local fallback", e);
    return { data: generatePlan(assignment), source: "fallback" };
  }
}

/** Real-LLM review; word count and readiness score are computed locally from the rubric weights. */
export async function reviewWorkAI(assignment: Assignment, submission: string): Promise<AiOutcome<ReviewResult>> {
  const local = reviewWork(assignment, submission);
  try {
    const r = await callAi({ action: "reviewWork", assignment: assignmentPayload(assignment), submission });
    const byName = new Map<string, { score: number; explanation: string }>();
    if (Array.isArray(r.rubricBreakdown)) {
      for (const c of r.rubricBreakdown as Record<string, unknown>[]) {
        const name = str(c?.criterion, 120);
        if (name) byName.set(name.toLowerCase(), { score: clamp(Math.round(num(c.score) ?? 0), 0, 100), explanation: str(c.explanation, 600) ?? "" });
      }
    }
    if (byName.size === 0) throw new Error("AI review missing rubric");
    const rubricBreakdown = assignment.rubric.map((c, i) => {
      const hit = byName.get((str(c.criterion, 120) ?? "").toLowerCase());
      return hit ? { criterion: c.criterion, ...hit } : local.rubricBreakdown[i];
    });
    const totalWeight = assignment.rubric.reduce((s, c) => s + c.weight, 0) || 100;
    const readinessScore = Math.round(rubricBreakdown.reduce((s, c, i) => s + c.score * (assignment.rubric[i]?.weight ?? 0), 0) / totalWeight);
    const suggestions = Array.isArray(r.suggestions)
      ? (r.suggestions as Record<string, unknown>[])
          .map((s) => ({ what: str(s?.what, 160) ?? "", why: str(s?.why, 400) ?? "", how: str(s?.how, 600) ?? "", priority: level(s?.priority) }))
          .filter((s) => s.what)
          .slice(0, 8)
      : [];
    const strengths = strList(r.strengths, 8);
    return {
      data: {
        ...local,
        readinessScore,
        rubricBreakdown,
        strengths: strengths.length ? strengths : local.strengths,
        missing: strList(r.missing, 10),
        suggestions: suggestions.length ? suggestions : local.suggestions,
        simulated: false,
      },
      source: "ai",
    };
  } catch (e) {
    console.warn("AI review failed, using local fallback", e);
    return { data: local, source: "fallback" };
  }
}
