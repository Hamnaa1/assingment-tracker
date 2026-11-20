import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMomentum } from "@/lib/momentum/store";
import { affectsSchedule, planWithPrefs, prefsOf, type PlanConflict, type RescheduleResult } from "@/lib/momentum/engine";
import { dashboardOf, type DashboardPrefs } from "@/lib/momentum/dashboard";
import type { SchedulePrefs } from "@/lib/momentum/schedule";
import type { OnboardingRecord } from "@/lib/momentum/onboarding";

interface Change { availability?: SchedulePrefs; dashboard?: DashboardPrefs; onboarding?: OnboardingRecord }

/**
 * Saves preference changes. When study habits/availability change, the future
 * plan is re-built automatically with the existing scheduling engine; if that
 * creates a conflict the student chooses how to proceed first.
 */
export function usePlanCommit() {
  const { state, dispatch } = useMomentum();
  const [pending, setPending] = useState<{ change: Change; result: RescheduleResult; conflicts: PlanConflict[]; done?: () => void } | null>(null);
  const notify = dashboardOf(state.dashboard).notifications?.planUpdates !== false;

  const apply = (change: Change, result?: RescheduleResult) => {
    dispatch({ type: "commitPrefs", ...change, plan: result && { sessions: result.sessions, removeIds: result.removeIds, taskUpdates: result.taskUpdates, log: result.log } });
    if (result && notify) toast.success("Your study plan has been updated.", { description: result.log.summary });
  };

  /** Returns true when saved immediately, false when waiting on a conflict decision. */
  const commit = (change: Change, done?: () => void): boolean => {
    if (!change.availability || !affectsSchedule(prefsOf(state), change.availability)) {
      apply(change);
      done?.();
      return true;
    }
    const { result, conflicts } = planWithPrefs(state, change.availability);
    if (conflicts.length) {
      setPending({ change, result, conflicts, done });
      return false;
    }
    apply(change, result);
    done?.();
    return true;
  };

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
      {pending && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-brand-warning-text" /> Check your new plan</DialogTitle>
            <DialogDescription>These changes affect your schedule. Nothing is saved until you choose.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {pending.conflicts.map((c, i) => (
              <li key={i} className="rounded-md border border-brand-warning/40 bg-brand-warning/10 p-2.5">{c.message}</li>
            ))}
          </ul>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setPending(null)}>Go back</Button>
            <Button variant="outline" onClick={() => { apply(pending.change); toast("Preferences saved — your current plan was kept."); pending.done?.(); setPending(null); }}>Save, keep current plan</Button>
            <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={() => { apply(pending.change, pending.result); pending.done?.(); setPending(null); }}>Update plan anyway</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { commit, dialog };
}
