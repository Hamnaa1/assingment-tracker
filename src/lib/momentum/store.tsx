import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { Assignment, FocusSession, ReviewResult, Task } from "./types";
import { seedDemoData } from "./demoData";

interface State {
  assignments: Assignment[];
  tasks: Task[];
  sessions: FocusSession[];
  reviews: ReviewResult[];
  studentName: string;
}

type Action =
  | { type: "addAssignment"; assignment: Assignment; tasks: Task[] }
  | { type: "updateAssignment"; assignment: Assignment }
  | { type: "deleteAssignment"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; task: Task }
  | { type: "toggleTask"; id: string }
  | { type: "deleteTask"; id: string }
  | { type: "addSession"; session: FocusSession }
  | { type: "addReview"; review: ReviewResult }
  | { type: "setName"; name: string }
  | { type: "reset" };

const STORAGE_KEY = "momentum-state-v1";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "addAssignment":
      return { ...state, assignments: [...state.assignments, action.assignment], tasks: [...state.tasks, ...action.tasks] };
    case "updateAssignment":
      return { ...state, assignments: state.assignments.map((a) => (a.id === action.assignment.id ? action.assignment : a)) };
    case "deleteAssignment":
      return {
        ...state,
        assignments: state.assignments.filter((a) => a.id !== action.id),
        tasks: state.tasks.filter((t) => t.assignmentId !== action.id),
      };
    case "addTask":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "updateTask":
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)) };
    case "toggleTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
            : t,
        ),
      };
    case "deleteTask":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "addSession":
      return { ...state, sessions: [...state.sessions, action.session] };
    case "addReview":
      return { ...state, reviews: [action.review, ...state.reviews] };
    case "setName":
      return { ...state, studentName: action.name };
    case "reset": {
      const seed = seedDemoData();
      return { ...state, ...seed, reviews: [] };
    }
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // corrupted storage — reseed
  }
  return { ...seedDemoData(), reviews: [], studentName: "Alex" };
}

const MomentumContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function MomentumProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <MomentumContext.Provider value={value}>{children}</MomentumContext.Provider>;
}

export function useMomentum() {
  const ctx = useContext(MomentumContext);
  if (!ctx) throw new Error("useMomentum must be used inside MomentumProvider");
  return ctx;
}

export function useAssignment(id?: string) {
  const { state } = useMomentum();
  const assignment = state.assignments.find((a) => a.id === id);
  const tasks = state.tasks.filter((t) => t.assignmentId === id);
  return { assignment, tasks };
}
