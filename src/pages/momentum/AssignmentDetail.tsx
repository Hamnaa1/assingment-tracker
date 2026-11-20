import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, Flag, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const { dispatch } = useMomentum();
  const { assignment, tasks } = useAssignment(id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();

  const sorted = useMemo(() => [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [tasks]);

  if (!assignment) {
    return (
      <EmptyDetail
        title="Assignment not found"
        hint="It may have been deleted. Head back to your assignment list."
      />
    );
  }

  const p = computePriority(assignment, tasks);
  const done = completionPct(tasks);
  const remainingMin = tasks.filter((t) => !t.completed).reduce((s, t) => s + t.estimatedMinutes, 0);
  const days = daysUntil(assignment.deadline);
  const overdueTasks = sorted.filter((t) => !t.completed && t.dueDate < new Date().toISOString().slice(0, 10));

  const behind = overdueTasks.length > 0;

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
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" className="bg-brand-soft-purple text-brand-charcoal hover:bg-brand-lilac/60">
            <Link to={`/focus?assignment=${assignment.id}`}>Start focus session</Link>
          </Button>
          <Button
            variant="outline"
            className="text-brand-error hover:text-brand-error"
            onClick={() => {
              dispatch({ type: "deleteAssignment", id: assignment.id });
              toast.success("Assignment deleted");
              navigate("/assignments");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Urgency", p.urgency, "40%"],
                  ["Workload left", p.workload, "25%"],
                  ["Importance", p.importance, "20%"],
                  ["Fall-behind risk", p.risk, "15%"],
                ].map(([label, v, w]) => (
                  <div key={label as string} className="rounded-lg bg-white/70 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {label} · {w}
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
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning" />
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
                  <p className={cn("ml-8 mt-1 text-xs", overdue ? "font-semibold text-brand-error" : "text-muted-foreground")}>
                    {overdue ? "Overdue · " : ""}Due {new Date(t.dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    {t.estimatedMinutes > 0 ? ` · ~${t.estimatedMinutes}min` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-start gap-1">
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
                    className="h-8 w-8 text-brand-error hover:text-brand-error"
                    aria-label="Delete task"
                    onClick={() => dispatch({ type: "deleteTask", id: t.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
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
