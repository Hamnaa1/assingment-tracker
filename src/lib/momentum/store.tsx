import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Assignment, CalendarEvent, CalendarFeed, FocusSession, ReviewResult, StudySession, Task } from "./types";
import { seedDemoData } from "./demoData";
import type { ScheduleLogEntry } from "./engine";
import type { PriorityWeights } from "./priority";
import type { SchedulePrefs } from "./schedule";
import type { DashboardPrefs } from "./dashboard";
import type { OnboardingRecord } from "./onboarding";

interface State {
  assignments: Assignment[];
  tasks: Task[];
  sessions: FocusSession[];
  reviews: ReviewResult[];
  studentName: string;
  studySessions?: StudySession[];
  calendarFeeds?: CalendarFeed[];
  calendarEvents?: CalendarEvent[];
  availability?: SchedulePrefs;
  priorityWeights?: PriorityWeights;
  scheduleLog?: ScheduleLogEntry[];
  dashboard?: DashboardPrefs;
  onboarding?: OnboardingRecord;
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
  | { type: "replaceTasks"; assignmentId: string; tasks: Task[] }
  | { type: "addStudySessions"; sessions: StudySession[]; replaceIds?: string[] }
  | { type: "updateStudySession"; session: StudySession }
  | { type: "deleteStudySession"; id: string }
  | { type: "upsertFeed"; feed: CalendarFeed; events?: CalendarEvent[] }
  | { type: "removeFeed"; id: string }
  | { type: "setAvailability"; availability: SchedulePrefs }
  | { type: "setWeights"; weights: PriorityWeights }
  | { type: "setDashboard"; dashboard: DashboardPrefs; availability?: SchedulePrefs }
  | { type: "setOnboarding"; onboarding: OnboardingRecord; dashboard?: DashboardPrefs; availability?: SchedulePrefs }
  | { type: "applyReschedule"; sessions: StudySession[]; removeIds: string[]; taskUpdates: Task[]; log: ScheduleLogEntry }
  | { type: "reset" }
  | { type: "hydrate"; state: State };

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
        studySessions: (state.studySessions ?? []).filter((s) => s.assignmentId !== action.id),
      };
    case "replaceTasks": {
      // Keep completed tasks; swap the rest for the regenerated plan.
      const keep = state.tasks.filter((t) => t.assignmentId !== action.assignmentId || t.completed);
      const keptIds = new Set(keep.map((t) => t.id));
      return {
        ...state,
        tasks: [...keep, ...action.tasks],
        studySessions: (state.studySessions ?? []).filter((s) => s.assignmentId !== action.assignmentId || !s.taskId || keptIds.has(s.taskId)),
      };
    }
    case "addStudySessions": {
      const drop = new Set(action.replaceIds ?? []);
      return { ...state, studySessions: [...(state.studySessions ?? []).filter((s) => !drop.has(s.id)), ...action.sessions] };
    }
    case "updateStudySession":
      return { ...state, studySessions: (state.studySessions ?? []).map((s) => (s.id === action.session.id ? action.session : s)) };
    case "deleteStudySession":
      return { ...state, studySessions: (state.studySessions ?? []).filter((s) => s.id !== action.id) };
    case "upsertFeed": {
      const feeds = state.calendarFeeds ?? [];
      const exists = feeds.some((f) => f.id === action.feed.id);
      return {
        ...state,
        calendarFeeds: exists ? feeds.map((f) => (f.id === action.feed.id ? action.feed : f)) : [...feeds, action.feed],
        calendarEvents: action.events
          ? [...(state.calendarEvents ?? []).filter((e) => e.feedId !== action.feed.id), ...action.events]
          : state.calendarEvents,
      };
    }
    case "setAvailability":
      return { ...state, availability: action.availability };
    case "setDashboard":
      return { ...state, dashboard: action.dashboard, availability: action.availability ?? state.availability };
    case "setOnboarding":
      return { ...state, onboarding: action.onboarding, dashboard: action.dashboard ?? state.dashboard, availability: action.availability ?? state.availability };
    case "setWeights":
      return { ...state, priorityWeights: action.weights };
    case "applyReschedule": {
      const drop = new Set(action.removeIds);
      const upd = new Map(action.taskUpdates.map((t) => [t.id, t]));
      return {
        ...state,
        tasks: state.tasks.map((t) => upd.get(t.id) ?? t),
        studySessions: [...(state.studySessions ?? []).filter((s) => !drop.has(s.id)), ...action.sessions],
        scheduleLog: [action.log, ...(state.scheduleLog ?? [])].slice(0, 10),
      };
    }
    case "removeFeed":
      return {
        ...state,
        calendarFeeds: (state.calendarFeeds ?? []).filter((f) => f.id !== action.id),
        calendarEvents: (state.calendarEvents ?? []).filter((e) => e.feedId !== action.id),
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
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        studySessions: (state.studySessions ?? []).filter((s) => s.taskId !== action.id),
      };
    case "addSession":
      return { ...state, sessions: [...state.sessions, action.session] };
    case "addReview":
      return { ...state, reviews: [action.review, ...state.reviews] };
    case "setName":
      return { ...state, studentName: action.name };
    case "hydrate":
      return action.state;
    case "reset": {
      const seed = seedDemoData();
      return { ...state, ...seed, reviews: [], studySessions: [] };
    }
  }
}

function fresh(): State {
  return { ...seedDemoData(), reviews: [], studentName: "Alex" };
}

function legacyLocal(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // ignore corrupted storage
  }
  return null;
}

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  session: Session | null;
  authReady: boolean;
  dataReady: boolean;
}

const MomentumContext = createContext<Ctx | null>(null);

export function MomentumProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, fresh);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Load this student's saved workspace from the cloud.
  useEffect(() => {
    if (!userId) {
      loadedFor.current = null;
      setDataReady(false);
      return;
    }
    if (loadedFor.current === userId) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("momentum_state").select("data").eq("user_id", userId).maybeSingle();
      if (!active) return;
      let next: State;
      if (data?.data && (data.data as unknown as State).assignments) {
        next = data.data as unknown as State;
      } else {
        next = legacyLocal() ?? fresh();
        await supabase.from("momentum_state").upsert({ user_id: userId, data: next as never });
      }
      loadedFor.current = userId;
      dispatch({ type: "hydrate", state: next });
      setDataReady(true);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Save changes back (debounced).
  useEffect(() => {
    if (!userId || !dataReady || loadedFor.current !== userId) return;
    const t = setTimeout(() => {
      supabase
        .from("momentum_state")
        .upsert({ user_id: userId, data: state as never, updated_at: new Date().toISOString() })
        .then(({ error }) => error && console.error("Save failed", error.message));
    }, 600);
    return () => clearTimeout(t);
  }, [state, userId, dataReady]);

  // Pick up changes made elsewhere (e.g. by a connected assistant) when the tab regains focus.
  useEffect(() => {
    if (!userId || !dataReady) return;
    const onFocus = async () => {
      const { data } = await supabase.from("momentum_state").select("data").eq("user_id", userId).maybeSingle();
      if (data?.data && (data.data as unknown as State).assignments) dispatch({ type: "hydrate", state: data.data as unknown as State });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId, dataReady]);

  const value = useMemo(() => ({ state, dispatch, session, authReady, dataReady }), [state, session, authReady, dataReady]);
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
