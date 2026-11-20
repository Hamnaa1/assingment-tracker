export type PriorityLevel = "low" | "medium" | "high" | "critical";

export interface RubricCriterion {
  criterion: string;
  weight: number; // percentage
}

export interface Assignment {
  id: string;
  title: string;
  module: string;
  deadline: string; // ISO date
  wordCount?: number;
  weighting?: number; // % of module grade
  difficulty: 1 | 2 | 3 | 4 | 5;
  deliverables: string[];
  rubric: RubricCriterion[];
  sections: string[];
  referencingStyle?: string;
  instructions?: string;
  briefText: string;
  createdAt: string;
}

export interface Task {
  id: string;
  assignmentId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  startDate: string; // ISO date
  dueDate: string; // ISO date
  priority: PriorityLevel;
  completed: boolean;
  completedAt?: string;
  milestone?: boolean;
}

export interface FocusSession {
  id: string;
  assignmentId?: string;
  taskId?: string;
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
}

export interface PriorityBreakdown {
  score: number; // 0-100
  level: PriorityLevel;
  urgency: number;
  workload: number;
  importance: number;
  risk: number;
  explanation: string;
}

export interface ReviewSuggestion {
  what: string;
  why: string;
  how: string;
  priority: PriorityLevel;
}

export interface ReviewResult {
  id: string;
  assignmentId: string;
  createdAt: string;
  readinessScore: number;
  wordCount: number;
  rubricBreakdown: { criterion: string; score: number; explanation: string }[];
  strengths: string[];
  missing: string[];
  suggestions: ReviewSuggestion[];
  simulated: true;
}
