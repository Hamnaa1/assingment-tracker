import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, ImagePlus, Instagram, Loader2, Lock, LockOpen, Pause, Play, ShieldAlert, Timer, Unlock, XCircle, Youtube } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMomentum } from "@/lib/momentum/store";
import { toast } from "sonner";

const DURATIONS = [25, 45, 60, 90];

const BLOCKED_APPS = [
  { name: "Instagram", icon: Instagram },
  { name: "TikTok", icon: Timer },
  { name: "Snapchat", icon: Camera },
  { name: "YouTube", icon: Youtube },
];

const MOTIVATION = [
  "Small steps, done consistently, beat last-minute panic.",
  "Future you is already grateful for this session.",
  "Focus now — freedom later.",
  "You don't need motivation, you need momentum. This is it.",
];

type Phase = "setup" | "active" | "intervention" | "proof" | "verifying" | "unlocked" | "done";

export default function Focus() {
  const { state, dispatch } = useMomentum();
  const [params] = useSearchParams();

  const [assignmentId, setAssignmentId] = useState(params.get("assignment") ?? "");
  const [taskId, setTaskId] = useState("");
  const [duration, setDuration] = useState(45);

  const [phase, setPhase] = useState<Phase>("setup");
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);
  const [paused, setPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<string>("");
  const [proofName, setProofName] = useState<string>("");
  const [verifyResult, setVerifyResult] = useState<"accepted" | "rejected" | null>(null);
  const startedRef = useRef<number>(0);

  const assignment = state.assignments.find((a) => a.id === assignmentId);
  const availableTasks = useMemo(
    () => state.tasks.filter((t) => t.assignmentId === assignmentId && !t.completed),
    [state.tasks, assignmentId],
  );
  const task = state.tasks.find((t) => t.id === taskId);
  const quote = MOTIVATION[Math.floor(secondsLeft / 300) % MOTIVATION.length];

  useEffect(() => {
    if (phase !== "active" || paused) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  useEffect(() => {
    if (phase === "active" && secondsLeft === 0) finishSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  const start = () => {
    if (!assignmentId) {
      toast.error("Choose an assignment first");
      return;
    }
    setSecondsLeft(duration * 60);
    setStartedAt(new Date().toISOString());
    startedRef.current = Date.now();
    setPaused(false);
    setPhase("active");
  };

  const finishSession = (completed: boolean) => {
    const actual = Math.round((Date.now() - startedRef.current) / 60000);
    dispatch({
      type: "addSession",
      session: {
        id: Math.random().toString(36).slice(2, 10),
        assignmentId: assignmentId || undefined,
        taskId: taskId || undefined,
        plannedMinutes: duration,
        actualMinutes: Math.max(1, Math.min(actual, duration)),
        startedAt,
        endedAt: new Date().toISOString(),
        completed,
      },
    });
    setPhase("done");
    if (completed) toast.success("Session complete — nice work.", { description: "Your focus hours have been logged." });
  };

  const submitProof = () => {
    if (!proofName) {
      toast.error("Add evidence first", { description: "Upload a screenshot or photo of your progress." });
      return;
    }
    setPhase("verifying");
    setVerifyResult(null);
    setTimeout(() => {
      // Simulated verification: accepts unless the file name hints at a meme/screenshot of socials.
      const suspicious = /meme|insta|tiktok|snap|youtube|game/i.test(proofName);
      setVerifyResult(suspicious ? "rejected" : "accepted");
      setPhase(suspicious ? "proof" : "unlocked");
    }, 2200);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = ((duration * 60 - secondsLeft) / (duration * 60)) * 100;

  /* ---------- SETUP ---------- */
  if (phase === "setup" || phase === "done") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Momentum Focus</h1>
          <p className="text-sm text-muted-foreground">Distraction-free deep work, with accountability built in.</p>
        </div>

        {phase === "done" && (
          <Card className="border-brand-success/40 bg-brand-success/10 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-brand-success" />
              <p className="text-sm font-semibold">Session logged. Your dashboard stats have been updated.</p>
            </CardContent>
          </Card>
        )}

        <Card className="mx-auto w-full max-w-xl border-border/80 shadow-sm">
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Label>Assignment</Label>
              <Select value={assignmentId} onValueChange={(v) => { setAssignmentId(v); setTaskId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assignment…" />
                </SelectTrigger>
                <SelectContent>
                  {state.assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Task (optional)</Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={!assignmentId}>
                <SelectTrigger>
                  <SelectValue placeholder={assignmentId ? "Choose a task…" : "Pick an assignment first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Focus duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => (
                  <Button
                    key={d}
                    variant={duration === d ? "default" : "outline"}
                    className={duration === d ? "bg-brand-lavender text-white hover:bg-brand-lavender/90" : ""}
                    onClick={() => setDuration(d)}
                  >
                    {d}m
                  </Button>
                ))}
              </div>
            </div>

            <Button size="lg" onClick={start} className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
              <Play className="mr-1.5 h-4 w-4" /> Start focus session
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Distraction blocking is a simulated demo feature — Momentum doesn't actually control other apps on your device.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- IMMERSIVE SESSION (charcoal) ---------- */
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-brand-charcoal px-4 py-8 text-white md:-mx-8 md:-my-8 md:px-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8">
        <div className="flex items-center gap-2 text-brand-lilac">
          <Timer className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Focus session</span>
        </div>

        <div className="text-center">
          <p className="text-sm text-white/60">{assignment?.title ?? "Free focus"}</p>
          {task && <p className="mt-1 text-lg font-bold text-brand-lilac">{task.title}</p>}
        </div>

        {/* Timer */}
        <div className="relative flex h-64 w-64 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#3a3749" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="46" fill="none" stroke="#8875e8" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="text-center">
            <p className="text-6xl font-extrabold tabular-nums tracking-tight">{mm}:{ss}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-white/50">{paused ? "paused" : "remaining"}</p>
          </div>
        </div>

        <p className="max-w-sm text-center text-sm italic text-white/60">“{quote}”</p>

        {/* Controls */}
        <div className="flex gap-3">
          <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setPaused(!paused)}>
            {paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" className="border-brand-error/50 bg-transparent text-brand-error hover:bg-brand-error/10" onClick={() => setPhase("intervention")}>
            End session
          </Button>
        </div>

        {/* Restricted apps */}
        <div className="w-full rounded-xl border border-white/10 bg-brand-charcoal-soft p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-lilac" />
            <p className="text-sm font-bold">Distraction protection <span className="ml-1 text-xs font-normal text-white/50">(simulated)</span></p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {BLOCKED_APPS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => setPhase("intervention")}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 opacity-70 transition hover:opacity-100"
              >
                <Icon className="h-6 w-6 text-white/70" />
                <span className="text-xs font-semibold">{name}</span>
                <Badge className="border-brand-error/40 bg-brand-error/15 text-[10px] text-brand-error" variant="outline">Restricted</Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Intervention overlay */}
        {phase === "intervention" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-md border-brand-lavender/40 bg-brand-charcoal-soft text-white">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <ShieldAlert className="h-10 w-10 text-brand-lilac" />
                <p className="text-lg font-bold">Hold on — you're {Math.round(progress)}% there.</p>
                <p className="text-sm text-white/70">
                  Leaving now breaks your momentum. {task ? `"${task.title}"` : "This session"} is exactly the work that moves {assignment?.title ?? "your degree"} forward.
                </p>
                <div className="flex w-full flex-col gap-2">
                  <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => setPhase("active")}>
                    Keep going
                  </Button>
                  <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setPhase("proof")}>
                    <Unlock className="mr-1.5 h-4 w-4" /> Request unlock with proof of progress
                  </Button>
                  <Button variant="ghost" className="text-white/50 hover:text-white" onClick={() => finishSession(false)}>
                    End anyway (manual override)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Proof submission */}
        {(phase === "proof" || phase === "verifying") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-md border-brand-lavender/40 bg-brand-charcoal-soft text-white">
              <CardContent className="flex flex-col gap-4 p-6">
                <p className="text-lg font-bold">Prove your progress</p>
                <p className="text-sm text-white/70">
                  Upload evidence of real work — a screenshot of your draft, a photo of handwritten notes, or research progress.
                </p>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-white/25 p-6 text-center hover:border-brand-lilac">
                  <ImagePlus className="h-8 w-8 text-brand-lilac" />
                  <span className="text-sm font-semibold">{proofName || "Choose a file"}</span>
                  <span className="text-xs text-white/50">Screenshots, photos, documents</span>
                  <input type="file" className="hidden" accept="image/*,.pdf,.txt" onChange={(e) => setProofName(e.target.files?.[0]?.name ?? "")} />
                </label>

                {phase === "verifying" && (
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-lilac" />
                    Momentum is verifying your evidence…
                  </div>
                )}
                {verifyResult === "rejected" && (
                  <div className="flex items-start gap-2 rounded-lg border border-brand-error/40 bg-brand-error/10 p-3 text-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-error" />
                    <span>
                      <span className="font-bold">Not quite.</span> This doesn't look like academic work. Upload evidence that shows real progress on {assignment?.title ?? "your assignment"} — e.g. your draft, notes or research.
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1 bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={submitProof} disabled={phase === "verifying"}>
                    Submit evidence
                  </Button>
                  <Button variant="ghost" className="text-white/60 hover:text-white" onClick={() => setPhase("intervention")}>
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Unlocked */}
        {phase === "unlocked" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <Card className="w-full max-w-md border-brand-success/40 bg-brand-charcoal-soft text-white">
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-success/15">
                  <LockOpen className="h-7 w-7 text-brand-success" />
                </div>
                <p className="text-lg font-bold">Evidence accepted — apps unlocked.</p>
                <p className="text-sm text-white/70">
                  Verified progress on {assignment?.title ?? "your assignment"}. You've earned a break — your session is logged.
                </p>
                <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => finishSession(true)}>
                  Finish session
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
