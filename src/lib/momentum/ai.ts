import type { Assignment, PriorityLevel, ReviewResult, RubricCriterion, Task } from "./types";
import { daysUntil } from "./priority";

const uid = () => Math.random().toString(36).slice(2, 10);

export interface BriefAnalysis {
  title: string;
  module: string;
  deadline: string;
  wordCount?: number;
  weighting?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  deliverables: string[];
  rubric: RubricCriterion[];
  sections: string[];
  referencingStyle?: string;
  instructions?: string;
  type?: string;
  description?: string;
  deadlineTime?: string;
  learningOutcomes?: string[];
  assessmentCriteria?: string[];
  submissionFormat?: string;
}

export const ASSIGNMENT_TYPES = ["Essay", "Report", "Presentation", "Case study", "Dissertation", "Portfolio", "Project", "Reflective piece", "Exam", "Other"];

/**
 * Simulated AI brief analysis (demo mode). Extracts structured assignment
 * details from pasted brief text using pattern matching — clearly labelled
 * as simulated in the UI.
 */
export function analyzeBrief(text: string): BriefAnalysis {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // Title: first meaningful line, stripped of common prefixes.
  const titleLine = lines[0] ?? "Untitled assignment";
  const title = titleLine.replace(/^(assignment|title|brief|task)\s*[:\-]\s*/i, "").slice(0, 90) || "Untitled assignment";

  // Module: look for module codes (e.g. MKT301, CS202) or "module: X".
  const moduleMatch = text.match(/module\s*[:\-]\s*([^\n,]+)/i) || text.match(/\b([A-Z]{2,4}\s?\d{3,4})\b/);
  const module = moduleMatch ? moduleMatch[1].trim().slice(0, 40) : "General Studies";

  // Deadline: ISO dates, "12 December 2026", "due in 10 days".
  let deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const longMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  const inDaysMatch = text.match(/due in (\d+)\s+days?/i);
  if (isoMatch) deadline = isoMatch[1];
  else if (longMatch) {
    const d = new Date(`${longMatch[2]} ${longMatch[1]}, ${longMatch[3]}`);
    if (!isNaN(d.getTime())) deadline = d.toISOString().slice(0, 10);
  } else if (inDaysMatch) {
    deadline = new Date(Date.now() + parseInt(inDaysMatch[1]) * 86400000).toISOString().slice(0, 10);
  }

  // Word count (spaces/tabs only — never let a year on the previous line match).
  const wordMatch = text.match(/(\d{3,5})[ \t]*[-–]?[ \t]*words?\b/i);
  const wordCount = wordMatch ? parseInt(wordMatch[1]) : undefined;

  // Weighting.
  const weightMatch = text.match(/(?:worth|weighted?|contributes?|accounts? for)\s*(\d{1,3})\s*%/i) || text.match(/(\d{1,3})\s*%\s*of\s*(?:the\s*)?(?:module|final|overall)/i);
  const weighting = weightMatch ? Math.min(100, parseInt(weightMatch[1])) : 30;

  // Referencing style.
  const refStyles = ["harvard", "apa", "mla", "chicago", "vancouver", "oscola", "ieee"];
  const referencingStyle = refStyles.find((s) => lower.includes(s));

  // Difficulty heuristic.
  const difficulty = (wordCount && wordCount >= 3000) || lower.includes("critical analysis") || lower.includes("research") ? 4 : wordCount && wordCount >= 1500 ? 3 : 2;

  // Deliverables.
  const deliverables: string[] = [];
  if (wordCount) deliverables.push(`${wordCount}-word submission`);
  if (lower.includes("report")) deliverables.push("Written report");
  if (lower.includes("essay")) deliverables.push("Essay");
  if (lower.includes("presentation") || lower.includes("slides")) deliverables.push("Presentation slides");
  if (lower.includes("poster")) deliverables.push("Academic poster");
  if (lower.includes("reflect")) deliverables.push("Reflective commentary");
  if (lower.includes("appendix") || lower.includes("appendices")) deliverables.push("Appendices");
  if (deliverables.length === 0) deliverables.push("Final written submission");

  // Sections: bullet-ish lines containing section keywords, else sensible defaults.
  const sectionKeywords = ["introduction", "literature", "method", "analysis", "discussion", "conclusion", "recommendation", "background", "findings", "evaluation", "reference"];
  const sections = lines
    .filter(
      (l) =>
        sectionKeywords.some((k) => l.toLowerCase().includes(k)) &&
        l.length < 80 &&
        !l.includes("%") && // rubric lines are not sections
        !/:\s*\d/.test(l),
    )
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  // "Required sections: A, B, C" on one line — split it into real sections.
  const sectionsLine = text.match(/(?:required\s+)?sections?\s*[:\-]\s*([^\n]+)/i);
  if (sectionsLine) {
    const parts = sectionsLine[1]
      .split(/[,;]/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter((s) => s.length > 2 && s.length < 60);
    if (parts.length >= 2) sections.splice(0, sections.length, ...parts.slice(0, 8));
  }
  if (sections.length === 0) sections.push("Introduction", "Main analysis", "Conclusion", "References");

  // Rubric: lines with percentages, else defaults.
  const rubric: RubricCriterion[] = [];
  const rubricRegex = /([A-Za-z][A-Za-z ,/&'-]{4,60}?)\s*[:\-–]\s*(\d{1,3})\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = rubricRegex.exec(text)) !== null && rubric.length < 8) {
    rubric.push({ criterion: m[1].trim(), weight: parseInt(m[2]) });
  }
  if (rubric.length === 0) {
    rubric.push(
      { criterion: "Critical analysis", weight: 30 },
      { criterion: "Use of evidence", weight: 25 },
      { criterion: "Structure & argument", weight: 20 },
      { criterion: "Clarity of writing", weight: 15 },
      { criterion: "Referencing", weight: 10 },
    );
  }

  const instructions = lines.find((l) => /must|should|ensure|required/i.test(l) && l.length > 40)?.slice(0, 200);

  // Type, time, description, outcomes, criteria and format.
  const type = ASSIGNMENT_TYPES.find((t) => lower.includes(t.toLowerCase())) ?? (lower.includes("reflect") ? "Reflective piece" : "Essay");
  const timeMatch = text.match(/(?:deadline|due|submit)[^\n]*?\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  let deadlineTime: string | undefined;
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    if (timeMatch[3]?.toLowerCase() === "pm" && h < 12) h += 12;
    if (timeMatch[3]?.toLowerCase() === "am" && h === 12) h = 0;
    if (h < 24) deadlineTime = `${String(h).padStart(2, "0")}:${timeMatch[2]}`;
  }
  const description = lines.slice(1).find((l) => l.length > 60 && !/:\s*\d/.test(l))?.slice(0, 400);
  const listAfter = (heading: RegExp) => {
    const i = lines.findIndex((l) => heading.test(l));
    if (i < 0) return [];
    const out: string[] = [];
    for (const l of lines.slice(i + 1)) {
      if (/^[A-Za-z ]{3,40}:\s*$/.test(l)) break;
      if (!/^[-•*\d.)]/.test(l) && out.length > 0) break;
      out.push(l.replace(/^[-•*\d.)\s]+/, "").trim());
      if (out.length >= 8) break;
    }
    return out.filter(Boolean);
  };
  const learningOutcomes = listAfter(/learning outcomes?/i);
  const assessmentCriteria = listAfter(/assessment criteria|marking criteria/i);
  const formatMatch = text.match(/(?:submission format|submit (?:as|via)|format)\s*[:\-]?\s*([^\n]{3,80})/i);
  const submissionFormat = formatMatch ? formatMatch[1].trim() : lower.includes("pdf") ? "PDF" : lower.includes("turnitin") ? "Turnitin upload" : undefined;

  return { type, description, deadlineTime, learningOutcomes, assessmentCriteria, submissionFormat, title, module, deadline, wordCount, weighting, difficulty: difficulty as 1 | 2 | 3 | 4 | 5, deliverables, rubric, sections, referencingStyle, instructions };
}

/**
 * Simulated AI plan generation: turns an assignment into a realistic,
 * dated task plan scaled to the deadline and word count.
 */
export function generatePlan(assignment: Assignment): Task[] {
  const now = new Date();
  const days = Math.max(daysUntil(assignment.deadline, now), 1);
  const words = assignment.wordCount ?? 1500;
  const hoursTotal = Math.max(4, Math.round(words / 250) + assignment.difficulty * 2);

  const tasks: Task[] = [];
  const mk = (
    title: string,
    description: string,
    estimatedMinutes: number,
    dayOffset: number,
    priority: PriorityLevel,
    milestone = false,
  ): Task => {
    const start = new Date(now.getTime() + Math.min(dayOffset, days - 1) * 86400000);
    const due = new Date(start.getTime() + 86400000);
    return {
      id: uid(),
      assignmentId: assignment.id,
      title,
      description,
      estimatedMinutes,
      startDate: start.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      priority,
      completed: false,
      milestone,
    };
  };

  const researchH = Math.max(1, Math.round(hoursTotal * 0.25));
  const draftH = Math.max(2, Math.round(hoursTotal * 0.5));
  const reviseH = Math.max(1, Math.round(hoursTotal * 0.15));

  let day = 0;
  tasks.push(mk("Analyse the brief & rubric", `Break down the ${assignment.title} brief: highlight every deliverable, rubric criterion and constraint.`, 45, day, "high"));
  tasks.push(mk("Research & gather sources", `Collect credible sources for ${assignment.module}. Aim for ${Math.max(5, Math.round(words / 300))} sources${assignment.referencingStyle ? ` formatted in ${assignment.referencingStyle.toUpperCase()}` : ""}.`, researchH * 60, (day += 1), "high"));
  tasks.push(mk("Create a detailed outline", `Map ${assignment.sections.slice(0, 4).join(", ")} into a structured outline with key points per section.`, 60, (day += 1), "medium", true));

  const draftDays = Math.max(1, days - day - 3);
  assignment.sections.slice(0, 4).forEach((section, i) => {
    tasks.push(mk(`Draft: ${section}`, `Write the ${section.toLowerCase()} section of ${assignment.title} against the rubric.`, Math.round((draftH * 60) / Math.min(4, assignment.sections.length)), day + i, i === 0 ? "high" : "medium"));
  });
  day += draftDays;

  tasks.push(mk("First full draft complete", `Milestone: a complete first draft of all ${assignment.deliverables[0] ?? "deliverables"}.`, 0, day, "high", true));
  tasks.push(mk("Revise & strengthen analysis", "Re-read against the rubric: deepen critical analysis, tighten argument flow, add missing evidence.", reviseH * 60, day + 1, "high"));
  tasks.push(mk("References & formatting check", `Verify every citation${assignment.referencingStyle ? ` against ${assignment.referencingStyle.toUpperCase()} style` : ""} and format the document to submission standards.`, 45, day + 2, "medium"));
  tasks.push(mk("Final proofread & submit", "Final proofread, word-count check, and submission. You’ve got this.", 60, days - 1, "critical", true));

  return tasks;
}

/**
 * Simulated AI review (demo mode): evaluates submitted work against the
 * assignment brief. Never claims citations are verified — only detected.
 */
export function reviewWork(assignment: Assignment, submission: string): ReviewResult {
  const words = submission.trim().split(/\s+/).filter(Boolean).length;
  const lower = submission.toLowerCase();

  const target = assignment.wordCount ?? 1500;
  const lengthScore = Math.min(100, Math.round((words / target) * 100));

  const sectionHits = assignment.sections.filter((s) => lower.includes(s.toLowerCase().split(" ")[0]));
  const coverageScore = assignment.sections.length ? Math.round((sectionHits.length / assignment.sections.length) * 100) : 70;

  const citationCount = (submission.match(/\([A-Z][A-Za-z]+(?:\s+et\s+al\.?)?,?\s+\d{4}\)/g) || []).length;
  const refScore = Math.min(100, citationCount * 15 + (lower.includes("reference") ? 20 : 0));

  const analysisWords = ["however", "therefore", "critically", "argues", "evidence", "suggests", "in contrast", "furthermore", "limitation", "implication"];
  const analysisHits = analysisWords.filter((w) => lower.includes(w)).length;
  const analysisScore = Math.min(100, analysisHits * 12);

  const paragraphs = submission.split(/\n\s*\n/).filter((p) => p.trim().length > 40).length;
  const structureScore = Math.min(100, paragraphs * 12);

  const rubricBreakdown = assignment.rubric.map((r) => {
    const key = r.criterion.toLowerCase();
    let score = 65;
    let explanation = "Partially addressed — see suggestions below.";
    if (key.includes("analysis") || key.includes("critical")) {
      score = analysisScore;
      explanation = analysisHits >= 6 ? "Strong critical engagement with evidence and counter-arguments." : "Limited critical language detected — deepen evaluation beyond description.";
    } else if (key.includes("evidence") || key.includes("research") || key.includes("source")) {
      score = refScore;
      explanation = citationCount >= 4 ? `Good use of sources — ${citationCount} in-text citations detected (not verified).` : "Few citations detected — support claims with credible sources.";
    } else if (key.includes("structure") || key.includes("argument")) {
      score = structureScore;
      explanation = paragraphs >= 6 ? "Clear paragraph structure with logical flow." : "Structure is thin — organise into clear sections with topic sentences.";
    } else if (key.includes("clarity") || key.includes("writing") || key.includes("present")) {
      score = Math.min(100, 60 + paragraphs * 5);
      explanation = "Readable overall — check sentence length and signposting.";
    } else if (key.includes("referenc")) {
      score = refScore;
      explanation = citationCount > 0 ? `${citationCount} citation patterns detected — accuracy not verified in demo mode.` : "No citation patterns detected.";
    }
    return { criterion: r.criterion, score, explanation };
  });

  const readinessScore = Math.round(
    rubricBreakdown.reduce((sum, r, i) => sum + r.score * (assignment.rubric[i]?.weight ?? 20), 0) / 100,
  );

  const strengths: string[] = [];
  if (lengthScore >= 90) strengths.push(`On target for length — ${words} of ~${target} words.`);
  if (analysisHits >= 5) strengths.push("Good critical vocabulary — your writing evaluates rather than just describes.");
  if (citationCount >= 4) strengths.push(`${citationCount} in-text citations detected — evidence is woven into the argument.`);
  if (sectionHits.length === assignment.sections.length && assignment.sections.length > 0) strengths.push("All required sections appear to be covered.");
  if (strengths.length === 0) strengths.push("A solid foundation to build on — the core content is in place.");

  const missing: string[] = [];
  assignment.sections.forEach((s) => {
    if (!sectionHits.includes(s)) missing.push(`The "${s}" section was not detected in your submission.`);
  });
  if (assignment.wordCount && words < assignment.wordCount * 0.7) missing.push(`Word count is ${words} — well under the ${assignment.wordCount}-word requirement.`);
  if (assignment.referencingStyle && citationCount === 0) missing.push(`No ${assignment.referencingStyle.toUpperCase()}-style citations detected.`);

  const suggestions: ReviewResult["suggestions"] = [];
  if (analysisScore < 70) suggestions.push({ what: "Deepen critical analysis", why: "Critical analysis typically carries the most rubric weight.", how: "For each claim, add evaluation: strengths, limitations and a counter-perspective.", priority: "high" });
  if (refScore < 60) suggestions.push({ what: "Strengthen evidence base", why: "Unsupported claims cost marks in the evidence criterion.", how: `Add credible academic sources and cite them${assignment.referencingStyle ? ` in ${assignment.referencingStyle.toUpperCase()} style` : ""}.`, priority: "high" });
  if (structureScore < 60) suggestions.push({ what: "Tighten structure", why: "Markers reward a clear, signposted argument.", how: "Use one idea per paragraph, open with a topic sentence, and link paragraphs explicitly.", priority: "medium" });
  if (lengthScore < 80) suggestions.push({ what: "Close the word-count gap", why: "Under-length submissions rarely cover the brief fully.", how: "Expand your analysis sections with evidence and examples rather than padding.", priority: "medium" });
  if (suggestions.length === 0) suggestions.push({ what: "Final polish", why: "Small refinements lift good work into the top band.", how: "Proofread aloud, check every rubric line once more, and verify formatting.", priority: "low" });

  return {
    id: uid(),
    assignmentId: assignment.id,
    createdAt: new Date().toISOString(),
    readinessScore,
    wordCount: words,
    rubricBreakdown,
    strengths,
    missing,
    suggestions,
    simulated: true,
  };
}
