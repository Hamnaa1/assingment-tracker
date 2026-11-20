import { priorityFor } from "@/lib/momentum/engine";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, Flame, FolderOpen, Plus, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useMomentum } from "@/lib/momentum/store";
import { completionPct, computePriority, daysUntil } from "@/lib/momentum/priority";
import { AssignmentCard, DeadlinePill, EmptyState, SectionTitle } from "@/components/momentum/shared";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { state, dispatch } = useMomentum();
  const { assignments, tasks, sessions, studentName } = state;

  const active = assignments.filter((a) => completionPct(tasks.filter((t) => t.assignmentId === a.id)) < 100);
  const completedTasks = tasks.filter((t) => t.completed).length;
  const studyMinutes = sessions.reduce((s, x) => s + x.actualMinutes, 0);
  const overall = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const nextWeek = assignments.filter((a) => daysUntil(a.deadline) <= 7 && daysUntil(a.deadline) >= 0).length;

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = tasks
    .filter((t) => !t.completed && t.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  const ranked = [...assignments]
    .map((a) => ({ a, p: priorityFor(state, a) }))
    .sort((x, y) => y.p.score - x.p.score);

  const top = ranked[0];
  const insight = top
    ? `You should prioritise "${top.a.title}" today. It is due in ${Math.max(daysUntil(top.a.deadline), 0)} day${daysUntil(top.a.deadline) === 1 ? "" : "s"}, contributes ${top.a.weighting ?? 20}% to your module grade, and you still have ${100 - completionPct(tasks.filter((t) => t.assignmentId === top.a.id))}% of the work remaining.`
    : null;

  const stats = [
    { label: "Active assignments", value: active.length, icon: FolderOpen },
    { label: "Deadlines this week", value: nextWeek, icon: Clock3 },
    { label: "Tasks completed", value: completedTasks, icon: CheckCircle2 },
    { label: "Focus hours", value: (studyMinutes / 60).toFixed(1), icon: Flame },
    { label: "Completion rate", value: `${overall}%`, icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-lavender">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back, {studentName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">We don't just help you plan your work. We help you actually do it.</p>
        </div>
        <Button asChild className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
          <Link to="/planner">
            <Plus className="mr-1.5 h-4 w-4" /> Add assignment
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/80 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft-purple">
                <Icon className="h-4 w-4 text-brand-lavender" />
              </div>
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI insight */}
      {insight && (
        <Card className="border-brand-lavender/30 bg-brand-soft-purple/60 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-lavender">
              <Sparkles className="h-4.5 w-4.5 text-white" size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-brand-charcoal">Momentum insight</p>
              <p className="mt-0.5 text-sm text-brand-charcoal/80">{insight}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Priority assignments */}
        <div className="lg:col-span-2">
          <SectionTitle
            title="Priority assignments"
            subtitle="Ranked by the Momentum priority engine"
            action={
              <Button asChild variant="ghost" size="sm" className="text-brand-lavender">
                <Link to="/assignments">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
          {ranked.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              hint="Add your first assignment brief and Momentum will build a personalised plan."
              action={
                <Button asChild className="mt-2 bg-brand-lavender text-white hover:bg-brand-lavender/90">
                  <Link to="/planner">Add assignment</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ranked.slice(0, 4).map(({ a }) => (
                <AssignmentCard key={a.id} assignment={a} tasks={tasks.filter((t) => t.assignmentId === a.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8">
          <div>
            <SectionTitle title="Today's tasks" subtitle="Due today or overdue" />
            <Card className="border-border/80 shadow-sm">
              <CardContent className="flex flex-col gap-1 p-3">
                {todaysTasks.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nothing due today — great position to get ahead.</p>}
                {todaysTasks.map((t) => {
                  const a = assignments.find((x) => x.id === t.assignmentId);
                  return (
                    <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 hover:bg-muted">
                      <Checkbox checked={t.completed} onCheckedChange={() => dispatch({ type: "toggleTask", id: t.id })} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-semibold", t.completed && "text-muted-foreground line-through")}>{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a?.title} · {t.estimatedMinutes}min
                        </span>
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div>
            <SectionTitle title="Upcoming deadlines" />
            <Card className="border-border/80 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                {[...assignments]
                  .sort((a, b) => a.deadline.localeCompare(b.deadline))
                  .slice(0, 5)
                  .map((a) => (
                    <Link key={a.id} to={`/assignments/${a.id}`} className="flex items-center justify-between gap-3 rounded-lg p-1.5 hover:bg-muted">
                      <span className="min-w-0 truncate text-sm font-semibold">{a.title}</span>
                      <DeadlinePill deadline={a.deadline} />
                    </Link>
                  ))}
                {assignments.length === 0 && <p className="text-sm text-muted-foreground">No deadlines yet.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
