import { priorityFor } from "@/lib/momentum/engine";
import { useMomentum } from "@/lib/momentum/store";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { LEVEL_STYLES, completionPct, computePriority, daysUntil } from "@/lib/momentum/priority";
import type { Assignment, PriorityLevel, Task } from "@/lib/momentum/types";

export function PriorityBadge({ level, score }: { level: PriorityLevel; score?: number }) {
  const s = LEVEL_STYLES[level];
  return (
    <Badge variant="outline" className={cn("font-semibold", s.badge)}>
      {score !== undefined ? `${score} · ` : ""}
      {s.label}
    </Badge>
  );
}

export function DeadlinePill({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  const overdue = days < 0;
  const soon = days <= 3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        overdue ? "text-brand-error" : soon ? "text-brand-warning" : "text-muted-foreground",
      )}
    >
      <CalendarClock className="h-3.5 w-3.5" />
      {overdue
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? "Due today"
          : `${days}d left`}{" "}
      · {new Date(deadline).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
    </span>
  );
}

export function AssignmentCard({ assignment, tasks }: { assignment: Assignment; tasks: Task[] }) {
  const { state } = useMomentum();
  const p = priorityFor(state, assignment);
  const done = completionPct(tasks);
  const remaining = tasks.filter((t) => !t.completed).length;

  return (
    <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/assignments/${assignment.id}`} className="block truncate text-base font-bold hover:text-brand-lavender">
              {assignment.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{assignment.module}</p>
          </div>
          <PriorityBadge level={p.level} score={p.score} />
        </div>

        <DeadlinePill deadline={assignment.deadline} />

        <div className="flex items-center gap-3">
          <Progress value={done} className="h-2 flex-1 [&>div]:bg-brand-lavender" />
          <span className="text-xs font-bold text-brand-lavender">{done}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {remaining} task{remaining === 1 ? "" : "s"} remaining
          </span>
          <Button asChild size="sm" variant="secondary" className="bg-brand-soft-purple text-brand-charcoal hover:bg-brand-lilac/60">
            <Link to={`/assignments/${assignment.id}`}>
              Open plan <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-base font-bold">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
