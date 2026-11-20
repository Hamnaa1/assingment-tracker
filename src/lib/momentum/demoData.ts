import type { Assignment, FocusSession, Task } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);

export function seedDemoData(): { assignments: Assignment[]; tasks: Task[]; sessions: FocusSession[] } {
  const marketing: Assignment = {
    id: uid(),
    title: "Digital Marketing Strategy Report",
    module: "MKT301 Digital Marketing",
    deadline: iso(3),
    wordCount: 3000,
    weighting: 40,
    difficulty: 4,
    deliverables: ["3000-word report", "Reference list"],
    rubric: [
      { criterion: "Critical analysis", weight: 30 },
      { criterion: "Use of evidence", weight: 25 },
      { criterion: "Strategy recommendations", weight: 25 },
      { criterion: "Structure & clarity", weight: 10 },
      { criterion: "Referencing", weight: 10 },
    ],
    sections: ["Introduction", "Market analysis", "Strategy recommendations", "Implementation plan", "Conclusion", "References"],
    referencingStyle: "harvard",
    instructions: "Critically evaluate a real brand's digital presence and propose an evidence-based strategy.",
    briefText: "Demo brief",
    createdAt: iso(-10),
  };

  const cs: Assignment = {
    id: uid(),
    title: "Algorithms Coursework: Pathfinding Visualiser",
    module: "CS202 Algorithms & Data Structures",
    deadline: iso(9),
    wordCount: 1500,
    weighting: 30,
    difficulty: 5,
    deliverables: ["Working application", "1500-word technical write-up"],
    rubric: [
      { criterion: "Correctness & complexity analysis", weight: 40 },
      { criterion: "Code quality", weight: 25 },
      { criterion: "Evaluation", weight: 20 },
      { criterion: "Write-up clarity", weight: 15 },
    ],
    sections: ["Design", "Implementation", "Complexity analysis", "Evaluation"],
    instructions: "Implement and compare at least two pathfinding algorithms.",
    briefText: "Demo brief",
    createdAt: iso(-6),
  };

  const psych: Assignment = {
    id: uid(),
    title: "Cognitive Psychology Essay",
    module: "PSY110 Cognitive Psychology",
    deadline: iso(16),
    wordCount: 2000,
    weighting: 25,
    difficulty: 3,
    deliverables: ["2000-word essay"],
    rubric: [
      { criterion: "Critical evaluation of theory", weight: 35 },
      { criterion: "Use of empirical evidence", weight: 30 },
      { criterion: "Argument structure", weight: 20 },
      { criterion: "Referencing", weight: 15 },
    ],
    sections: ["Introduction", "Theory overview", "Evidence & evaluation", "Conclusion"],
    referencingStyle: "apa",
    briefText: "Demo brief",
    createdAt: iso(-3),
  };

  const t = (
    assignmentId: string,
    title: string,
    description: string,
    estimatedMinutes: number,
    start: number,
    due: number,
    priority: Task["priority"],
    completed = false,
    milestone = false,
  ): Task => ({
    id: uid(),
    assignmentId,
    title,
    description,
    estimatedMinutes,
    startDate: iso(start),
    dueDate: iso(due),
    priority,
    completed,
    completedAt: completed ? new Date(Date.now() + start * 86400000).toISOString() : undefined,
    milestone,
  });

  const tasks: Task[] = [
    t(marketing.id, "Analyse the brief & rubric", "Highlight every deliverable and rubric criterion.", 45, -9, -8, "high", true),
    t(marketing.id, "Research & gather sources", "Collect 10 credible sources on digital strategy.", 180, -8, -6, "high", true),
    t(marketing.id, "Create a detailed outline", "Map sections and key points per section.", 60, -6, -5, "medium", true, true),
    t(marketing.id, "Draft: Market analysis", "Write the market analysis section with evidence.", 150, -4, -2, "high", true),
    t(marketing.id, "Draft: Strategy recommendations", "Draft the strategy section against the rubric.", 150, -2, 0, "high"),
    t(marketing.id, "Draft: Implementation plan", "Timeline, budget and KPIs for the strategy.", 120, 0, 1, "high"),
    t(marketing.id, "Revise & strengthen analysis", "Deepen critical evaluation throughout.", 90, 1, 2, "high"),
    t(marketing.id, "References & final proofread", "Harvard check, word count, submit.", 60, 2, 3, "critical", false, true),

    t(cs.id, "Research pathfinding algorithms", "Compare A*, Dijkstra and BFS trade-offs.", 120, -5, -3, "high", true),
    t(cs.id, "Build grid & visualisation scaffold", "Canvas grid, walls, start/end selection.", 180, -3, -1, "high", true),
    t(cs.id, "Implement Dijkstra & A*", "Both algorithms with step visualisation.", 240, -1, 2, "high"),
    t(cs.id, "Complexity analysis", "Big-O analysis and empirical timing comparison.", 90, 2, 4, "medium"),
    t(cs.id, "Write technical report", "1500-word write-up with evaluation.", 180, 4, 7, "medium"),
    t(cs.id, "Final testing & submit", "Edge cases, polish, submit.", 90, 7, 8, "critical", false, true),

    t(psych.id, "Gather empirical studies", "Find 8 peer-reviewed studies on working memory.", 120, -2, 1, "medium", true),
    t(psych.id, "Essay outline", "Thesis, argument map, evidence per paragraph.", 60, 1, 3, "medium"),
    t(psych.id, "Draft essay", "Full first draft of the essay.", 240, 3, 9, "medium"),
    t(psych.id, "Revise & submit", "Evaluation depth, APA references, proofread.", 120, 9, 14, "high", false, true),
  ];

  const sessions: FocusSession[] = [
    { id: uid(), assignmentId: marketing.id, plannedMinutes: 45, actualMinutes: 45, startedAt: new Date(Date.now() - 86400000 * 2).toISOString(), endedAt: new Date(Date.now() - 86400000 * 2 + 45 * 60000).toISOString(), completed: true },
    { id: uid(), assignmentId: cs.id, plannedMinutes: 60, actualMinutes: 52, startedAt: new Date(Date.now() - 86400000).toISOString(), endedAt: new Date(Date.now() - 86400000 + 52 * 60000).toISOString(), completed: true },
    { id: uid(), assignmentId: marketing.id, plannedMinutes: 25, actualMinutes: 25, startedAt: new Date(Date.now() - 86400000 * 0.2).toISOString(), endedAt: new Date(Date.now() - 86400000 * 0.2 + 25 * 60000).toISOString(), completed: true },
  ];

  return { assignments: [marketing, cs, psych], tasks, sessions };
}
