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
  instructions?: string; // additional lecturer instructions
  type?: string; // essay, report, presentation...
  description?: string;
  deadlineTime?: string; // HH:mm, local
  learningOutcomes?: string[];
  assessmentCriteria?: string[];
  submissionFormat?: string;
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
  /** Minutes the timer actually ran (excludes pauses and breaks). Used for XP. */
  activeMinutes?: number;
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
  difficulty?: number;
  weights?: { urgency: number; workload: number; importance: number; difficulty: number; risk: number };
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

/** A study session scheduled by Momentum, linked to an assignment and task. */
export interface StudySession {
  id: string;
  assignmentId: string;
  taskId?: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  description?: string;
  reminderMinutes: number;
  /** Locked sessions are never moved by automatic rescheduling. */
  locked?: boolean;
}

export type CalendarProvider = "google" | "outlook" | "apple" | "other";

/** A read-only calendar subscription (private iCal/ICS link). */
export interface CalendarFeed {
  id: string;
  provider: CalendarProvider;
  label: string;
  url: string;
  lastSyncedAt?: string;
  status: "ok" | "error" | "pending";
  error?: string;
}

/** An event read from a connected calendar feed. */
export interface CalendarEvent {
  id: string;
  feedId: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  allDay: boolean;
  location?: string;
}
