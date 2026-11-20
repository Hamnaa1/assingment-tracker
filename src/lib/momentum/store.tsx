import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
    case "hydrate":
      return action.state;
    case "reset": {
      const seed = seedDemoData();
      return { ...state, ...seed, reviews: [] };
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
