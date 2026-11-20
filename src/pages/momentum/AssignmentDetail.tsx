import { prefsOf, priorityFor } from "@/lib/momentum/engine";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CalendarPlus, CalendarRange, Check, Flag, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { AssignmentForm, draftFromAssignment, validateDraft, type AssignmentDraft } from "@/components/momentum/AssignmentForm";
import { ScheduleDialog } from "@/components/momentum/ScheduleDialog";
import { generatePlanAI } from "@/lib/momentum/aiClient";
import { busyIntervals, scheduleTasks, type ScheduleResult } from "@/lib/momentum/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAssignment, useMomentum } from "@/lib/momentum/store";
import { LEVEL_STYLES, completionPct, computePriority, daysUntil } from "@/lib/momentum/priority";
import type { PriorityLevel, Task } from "@/lib/momentum/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function TaskDialog({ assignmentId, task, onDone }: { assignmentId: string; task?: Task; onDone: () => void }) {
  const { dispatch } = useMomentum();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [minutes, setMinutes] = useState(task?.estimatedMinutes ?? 60);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<PriorityLevel>(task?.priority ?? "medium");

  const save = () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (task) {
      dispatch({ type: "updateTask", task: { ...task, title, description, estimatedMinutes: minutes, dueDate, priority } });
      toast.success("Task updated");
    } else {
      dispatch({
        type: "addTask",
        task: {
          id: Math.random().toString(36).slice(2, 10),
          assignmentId,
          title,
          description,
          estimatedMinutes: minutes,
          startDate: new Date().toISOString().slice(0, 10),
          dueDate,
          priority,
          completed: false,
        },
      });
      toast.success("Task added");
    }
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Draft the introduction" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-desc">Description</Label>
          <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-min">Est. minutes</Label>
            <Input id="t-min" type="number" min={0} value={minutes} onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-due">Due date</Label>
            <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as PriorityLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={save} className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
          {task ? "Save changes" : "Add task"}
        </Button>
      </div>
    </DialogContent>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch, commit } = useMomentum();
  const { assignment, tasks } = useAssignment(id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [planStale, setPlanStale] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null);
  const [preview, setPreview] = useState<ScheduleResult | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const sessions = useMemo(() => (state.studySessions ?? []).filter((s) => s.assignmentId === id), [state.studySessions, id]);

  const sorted = useMemo(() => [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [tasks]);

  if (!assignment) {
    return (
      <EmptyDetail
        title="Assignment not found"
        hint="It may have been deleted. Head back to your assignment list."
      />
    );
  }

  const p = priorityFor(state, assignment);
  const done = completionPct(tasks);
  const remainingMin = tasks.filter((t) => !t.completed).reduce((s, t) => s + t.estimatedMinutes, 0);
  const days = daysUntil(assignment.deadline);
  const overdueTasks = sorted.filter((t) => !t.completed && t.dueDate < new Date().toISOString().slice(0, 10));

  const behind = overdueTasks.length > 0;
  const nowIso = new Date().toISOString();
  const futureSessions = sessions.filter((s) => s.start > nowIso);
  const otherSessions = (state.studySessions ?? []).filter((s) => s.assignmentId !== assignment.id || s.start <= nowIso);
  const availability = scheduleTasks(tasks, assignment.deadline, busyIntervals(state.calendarEvents ?? [], otherSessions, prefsOf(state).bufferMinutes), new Date(), prefsOf(state));
  const tight = availability.unscheduledMinutes > 0;

  const saveEdits = () => {
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) {
      toast.error(err);
      return;
    }
    dispatch({ type: "updateAssignment", assignment: { ...assignment, ...draft } });
    setDraft(null);
    setPlanStale(true);
    toast.success("Assignment saved", { description: "Regenerate your plan to use the updated details." });
  };

  const regenerate = async () => {
    setRegenerating(true);
    const done = tasks.filter((t) => t.completed);
    const doneTitles = new Set(done.map((t) => t.title.toLowerCase()));
    const next = (await generatePlanAI(assignment, done.map((t) => t.title))).data.filter((t) => !doneTitles.has(t.title.toLowerCase()));
    dispatch({ type: "replaceTasks", assignmentId: assignment.id, tasks: next });
    setRegenerating(false);
    setPlanStale(false);
    setRegenOpen(false);
    toast.success("Plan regenerated", { description: "Completed tasks were kept. Re-run “Schedule around my calendar” to book new sessions." });
  };

  const confirmSchedule = () => {
    if (!preview) return;
    dispatch({ type: "addStudySessions", sessions: preview.sessions, replaceIds: futureSessions.map((s) => s.id) });
    setPreview(null);
    toast.success(`${preview.sessions.length} study sessions scheduled`, { description: "See them on your Calendar page." });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{assignment.title}</h1>
            <Badge variant="outline" className={cn("font-semibold", LEVEL_STYLES[p.level].badge)}>
              {p.score} · {LEVEL_STYLES[p.level].label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {assignment.module} · {assignment.wordCount ? `${assignment.wordCount} words · ` : ""}
            {assignment.weighting ?? 20}% of module grade
            {assignment.referencingStyle ? ` · ${assignment.referencingStyle.toUpperCase()} referencing` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setDraft(draftFromAssignment(assignment))} disabled={!!draft}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit Assignment
          </Button>
          <Button asChild variant="secondary" className="bg-brand-soft-purple text-brand-charcoal hover:bg-brand-lilac/60">
            <Link to={`/focus?assignment=${assignment.id}`}>Start focus session</Link>
          </Button>
          <Button
            variant="outline"
            className="text-brand-error-text hover:text-brand-error-text"
            aria-label="Delete assignment"
            onClick={() => {
              if (!window.confirm(`Delete “${assignment.title}” and its tasks and study sessions?`)) return;
              const del = async () => {
                try {
                  await commit({ type: "deleteAssignment", id: assignment.id });
                  toast.success("Assignment deleted");
                  navigate("/assignments");
                } catch {
                  toast.error("Couldn't delete — your connection or account session may have dropped.", { action: { label: "Retry", onClick: () => void del() } });
                }
              };
              void del();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {draft && (
        <Card className="border-brand-lavender/40 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Edit assignment</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={saveEdits}>Save Changes</Button>
            </div>
          </CardHeader>
          <CardContent>
            <AssignmentForm value={draft} onChange={setDraft} />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={saveEdits}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {planStale && !draft && (
        <Card className="border-brand-lavender/30 bg-brand-soft-purple/60 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-brand-charcoal"><span className="font-bold">Details updated.</span> Regenerate the plan so tasks match your corrected brief. Completed tasks are kept.</p>
            <Button size="sm" className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={regenerate} disabled={regenerating}><RefreshCw className={cn("mr-1.5 h-4 w-4", regenerating && "animate-spin")} /> Regenerate plan</Button>
          </CardContent>
        </Card>
      )}

      {!draft && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Assignment details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Type" value={assignment.type} />
            <Detail label="Deadline" value={`${new Date(assignment.deadline + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}${assignment.deadlineTime ? ` · ${assignment.deadlineTime}` : ""}`} />
            <Detail label="Difficulty" value={`${assignment.difficulty} / 5`} />
            <Detail label="Submission format" value={assignment.submissionFormat} />
            <Detail className="sm:col-span-2" label="Description" value={assignment.description} />
            <ListDetail label="Required tasks" items={assignment.deliverables} />
            <ListDetail label="Required sections" items={assignment.sections} />
            <ListDetail label="Learning outcomes" items={assignment.learningOutcomes} />
            <ListDetail label="Assessment criteria" items={assignment.assessmentCriteria} />
            <ListDetail label="Rubric" items={assignment.rubric.map((r) => `${r.criterion} — ${r.weight}%`)} />
            <Detail label="Lecturer instructions" value={assignment.instructions} />
          </CardContent>
        </Card>
      )}

      {/* Calendar-aware scheduling */}
      <Card className={cn("shadow-sm", tight ? "border-brand-warning/40 bg-brand-warning/10" : "border-border/80")}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <CalendarRange className={cn("mt-0.5 h-5 w-5 shrink-0", tight ? "text-brand-warning-text" : "text-brand-lavender")} />
            <div className="text-sm">
              <p className="font-bold">
                {tight
                  ? `Not enough free time: about ${Math.round(availability.unscheduledMinutes / 6) / 10}h of work won't fit before the deadline.`
                  : `${Math.round(availability.availableMinutes / 6) / 10}h free before the deadline for ${Math.round(availability.neededMinutes / 6) / 10}h of remaining work.`}
              </p>
              <p className="text-xs text-muted-foreground">
                {tight
                  ? "Try shortening task estimates, moving commitments, or starting earlier each day."
                  : (state.calendarFeeds ?? []).length
                    ? "Based on your connected calendar and your study availability."
                    : "Connect a calendar in Settings so this accounts for your lectures, shifts and plans."}
                {futureSessions.length > 0 && ` · ${futureSessions.length} upcoming session${futureSessions.length > 1 ? "s" : ""} booked.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setRegenOpen(true)}><RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate plan</Button>
            <Button size="sm" className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => setPreview(scheduleTasks(tasks, assignment.deadline, busyIntervals(state.calendarEvents ?? [], otherSessions, prefsOf(state).bufferMinutes), new Date(), prefsOf(state)))}>
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Schedule around my calendar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Priority explanation + progress */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-brand-lavender/30 bg-brand-soft-purple/60 shadow-sm lg:col-span-2">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-lavender">
              <Sparkles className="h-4.5 w-4.5 text-white" size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand-charcoal">Why this priority?</p>
              <p className="mt-0.5 text-sm text-brand-charcoal/80">{p.explanation}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Urgency", p.urgency, p.weights?.urgency],
                  ["Workload left", p.workload, p.weights?.workload],
                  ["Grade weighting", p.importance, p.weights?.importance],
                  ["Difficulty", p.difficulty ?? 0, p.weights?.difficulty],
                  ["Fall-behind risk", p.risk, p.weights?.risk],
                ].map(([label, v, wt]) => (
                  <div key={label as string} className="rounded-lg bg-white/70 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {label} · {Math.round((wt as number) ?? 0)}%
                    </p>
                    <p className="text-lg font-extrabold text-brand-charcoal">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex h-full flex-col justify-center gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Overall progress</span>
              <span className="text-sm font-extrabold text-brand-lavender">{done}%</span>
            </div>
            <Progress value={done} className="h-2.5 [&>div]:bg-brand-lavender" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days} days left`}
              </span>
              <span>{Math.round(remainingMin / 60 * 10) / 10}h work remaining</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {behind && (
        <Card className="border-brand-warning/40 bg-brand-warning/10 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning-text" />
            <p className="text-sm">
              <span className="font-bold">You're falling behind.</span> {overdueTasks.length} task{overdueTasks.length === 1 ? " is" : "s are"} overdue.
              Prioritise "{overdueTasks[0].title}" today, then shift remaining tasks one day forward to get back on track.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline / task plan */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Task plan & timeline</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditing(undefined)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add task
              </Button>
            </DialogTrigger>
            <TaskDialog assignmentId={assignment.id} task={editing} onDone={() => setDialogOpen(false)} />
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col">
          {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet — add your first task.</p>}
          {sorted.map((t, i) => {
            const overdue = !t.completed && t.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <div key={t.id} className="relative flex gap-4 pb-5 pl-1">
                {/* timeline rail */}
                {i < sorted.length - 1 && <span className="absolute left-[13px] top-7 h-full w-px bg-border" />}
                <span
                  className={cn(
                    "z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    t.completed
                      ? "border-brand-success bg-brand-success text-white"
                      : t.milestone
                        ? "border-brand-lavender bg-brand-soft-purple"
                        : "border-border bg-card",
                  )}
                >
                  {t.completed ? <Check className="h-3.5 w-3.5" /> : t.milestone ? <Flag className="h-3 w-3 text-brand-lavender" /> : null}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox checked={t.completed} onCheckedChange={() => dispatch({ type: "toggleTask", id: t.id })} aria-label="Mark complete" />
                    <span className={cn("text-sm font-bold", t.completed && "text-muted-foreground line-through")}>{t.title}</span>
                    <Badge variant="outline" className={cn("text-[11px]", LEVEL_STYLES[t.priority].badge)}>
                      {LEVEL_STYLES[t.priority].label}
                    </Badge>
                    {t.milestone && (
                      <Badge variant="outline" className="border-brand-lilac/50 bg-brand-soft-purple text-[11px] text-brand-charcoal">
                        Milestone
                      </Badge>
                    )}
                  </div>
                  {t.description && <p className="ml-8 mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                  <p className={cn("ml-8 mt-1 text-xs", overdue ? "font-semibold text-brand-error-text" : "text-muted-foreground")}>
                    {overdue ? "Overdue · " : ""}Due {new Date(t.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    {t.estimatedMinutes > 0 ? ` · ~${t.estimatedMinutes}min` : ""}
                  </p>
                  {sessions.filter((s) => s.taskId === t.id).map((s) => (
                    <p key={s.id} className="ml-8 mt-1 inline-flex items-center gap-1 rounded bg-brand-soft-purple px-1.5 py-0.5 text-[11px] font-semibold text-brand-charcoal">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(s.start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ))}
                </div>

                <div className="flex shrink-0 items-start gap-1">
                  {!t.completed && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Schedule study session" title="Schedule study session" onClick={() => setScheduleFor(t)}>
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Edit task"
                    onClick={() => {
                      setEditing(t);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-brand-error-text hover:text-brand-error-text"
                    aria-label="Delete task"
                    onClick={() => window.confirm(`Delete “${t.title}”?`) && dispatch({ type: "deleteTask", id: t.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        {scheduleFor && <ScheduleDialog key={scheduleFor.id} assignment={assignment} task={scheduleFor} onDone={() => setScheduleFor(null)} />}
      </Dialog>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate plan?</DialogTitle>
            <DialogDescription>Momentum rebuilds unfinished tasks from your saved assignment details. Completed tasks stay; sessions booked for replaced tasks are removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={regenerate} disabled={regenerating}>{regenerating ? "Regenerating…" : "Regenerate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        {preview && (
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proposed study sessions</DialogTitle>
              <DialogDescription>
                Planned in your free time, with breaks around existing events.
                {futureSessions.length > 0 && ` Confirming replaces the ${futureSessions.length} upcoming session${futureSessions.length > 1 ? "s" : ""} already booked for this assignment.`}
              </DialogDescription>
            </DialogHeader>
            {preview.unscheduledMinutes > 0 && (
              <p className="rounded-lg bg-brand-warning/15 p-2.5 text-xs font-semibold">
                About {Math.round(preview.unscheduledMinutes / 6) / 10}h couldn't fit before the deadline. Consider reducing scope or freeing up time.
              </p>
            )}
            {preview.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to schedule — all tasks are done or have no time estimate.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {preview.sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm">
                    <span className="truncate font-semibold">{s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(s.start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000)}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
              <Button disabled={preview.sessions.length === 0} className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={confirmSchedule}>Confirm schedule</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 whitespace-pre-line", !value && "italic text-muted-foreground")}>{value || "Not set"}</p>
    </div>
  );
}

function ListDetail({ label, items }: { label: string; items?: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {items && items.length ? (
        <ul className="mt-0.5 list-disc pl-4">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>
      ) : (
        <p className="mt-0.5 italic text-muted-foreground">None added</p>
      )}
    </div>
  );
}

function EmptyDetail({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Button asChild className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
        <Link to="/assignments">My assignments</Link>
      </Button>
    </div>
  );
}
