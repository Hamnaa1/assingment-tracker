import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMomentum } from "@/lib/momentum/store";
import { computePriority } from "@/lib/momentum/priority";
import { AssignmentCard, EmptyState } from "@/components/momentum/shared";

export default function Assignments() {
  const { state } = useMomentum();
  const ranked = [...state.assignments]
    .map((a) => ({ a, p: computePriority(a, state.tasks.filter((t) => t.assignmentId === a.id)) }))
    .sort((x, y) => y.p.score - x.p.score);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Assignments</h1>
          <p className="text-sm text-muted-foreground">Every assignment, ranked by what needs your attention most.</p>
        </div>
        <Button asChild className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
          <Link to="/planner">
            <Plus className="mr-1.5 h-4 w-4" /> Add assignment
          </Link>
        </Button>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          hint="Paste or upload a brief in the AI Planner and Momentum will generate a personalised task plan."
          action={
            <Button asChild className="mt-2 bg-brand-lavender text-white hover:bg-brand-lavender/90">
              <Link to="/planner">Open AI Planner</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ranked.map(({ a }) => (
            <AssignmentCard key={a.id} assignment={a} tasks={state.tasks.filter((t) => t.assignmentId === a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
