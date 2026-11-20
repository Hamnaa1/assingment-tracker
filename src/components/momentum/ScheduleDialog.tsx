import { useMemo, useState } from "react";
import { CalendarPlus, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMomentum } from "@/lib/momentum/store";
import { busyIntervals, findSlot } from "@/lib/momentum/schedule";
import { prefsOf } from "@/lib/momentum/engine";
import { buildIcs, downloadIcs } from "@/lib/momentum/ics";
import type { Assignment, StudySession, Task } from "@/lib/momentum/types";
import { toast } from "sonner";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Create or edit a Momentum study session for a task, suggesting a free slot from the student's calendar. */
export function ScheduleDialog({ assignment, task, session, onDone }: { assignment: Assignment; task?: Task; session?: StudySession; onDone: () => void }) {
  const { state, dispatch } = useMomentum();
  const others = useMemo(() => (state.studySessions ?? []).filter((s) => s.id !== session?.id), [state.studySessions, session?.id]);
  const busy = useMemo(() => busyIntervals(state.calendarEvents ?? [], others, prefsOf(state).bufferMinutes), [state.calendarEvents, others]);

  const initialMinutes = session ? Math.round((Date.parse(session.end) - Date.parse(session.start)) / 60000) : Math.min(120, Math.max(30, task?.estimatedMinutes || 60));
  const suggest = (minutes: number) => {
    const due = new Date((task?.dueDate ?? assignment.deadline) + "T23:59:00");
    const deadline = new Date(assignment.deadline + "T23:59:00");
    const prefs = prefsOf(state);
    return findSlot(minutes, new Date(), due, busy, prefs) ?? findSlot(minutes, new Date(), deadline, busy, prefs);
  };
  const first = session ? { start: Date.parse(session.start) } : suggest(initialMinutes);

  const [start, setStart] = useState(first ? toLocalInput(new Date(first.start)) : toLocalInput(new Date(Date.now() + 3600000)));
  const [minutes, setMinutes] = useState(initialMinutes);
  const [description, setDescription] = useState(session?.description ?? task?.description ?? "");
  const [reminder, setReminder] = useState(String(session?.reminderMinutes ?? 15));
  const [saved, setSaved] = useState<StudySession | null>(null);

  const startMs = new Date(start).getTime();
  const endMs = startMs + minutes * 60000;
  const clash = (state.calendarEvents ?? []).find((e) => !e.allDay && Date.parse(e.start) < endMs && startMs < Date.parse(e.end))
    ?? others.find((s) => Date.parse(s.start) < endMs && startMs < Date.parse(s.end));
  const noCalendar = (state.calendarFeeds ?? []).length === 0;

  const findTime = () => {
    const slot = suggest(minutes);
    if (!slot) {
      toast.error("No free time found before the due date", { description: "Try a shorter session or pick a time manually." });
      return;
    }
    setStart(toLocalInput(new Date(slot.start)));
    toast.success("Found a free slot", { description: new Date(slot.start).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  };

  const confirm = () => {
    if (isNaN(startMs) || minutes < 15) {
      toast.error("Choose a start time and at least 15 minutes");
      return;
    }
    const next: StudySession = {
      id: session?.id ?? Math.random().toString(36).slice(2, 10),
      assignmentId: assignment.id,
      taskId: session?.taskId ?? task?.id,
      title: session?.title ?? task?.title ?? assignment.title,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      description: description || undefined,
      reminderMinutes: Number(reminder),
    };
    if (session) dispatch({ type: "updateStudySession", session: next });
    else dispatch({ type: "addStudySessions", sessions: [next] });
    toast.success(session ? "Study session rescheduled" : "Study session added to your Momentum calendar");
    setSaved(next);
  };

  if (saved) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session saved</DialogTitle>
          <DialogDescription>
            It's on your Momentum calendar. To put it in Google, Outlook or Apple Calendar too, download the calendar file and open it — your calendar app will ask you to confirm.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => downloadIcs(`momentum-${saved.title.replace(/\W+/g, "-").toLowerCase()}.ics`, buildIcs([saved], [assignment]))}>
            <Download className="mr-1.5 h-4 w-4" /> Download for my calendar
          </Button>
          <Button className="bg-brand-lavender text-white hover:bg-brand-lavender/90" onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{session ? "Reschedule study session" : "Schedule study session"}</DialogTitle>
        <DialogDescription>
          {assignment.title}
          {task || session ? ` · ${session?.title ?? task?.title}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        {noCalendar && (
          <p className="rounded-lg bg-brand-soft-purple/60 p-2.5 text-xs text-brand-charcoal">
            No personal calendar connected — suggestions only avoid your other Momentum sessions. Connect a calendar in Settings for smarter times.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="sd-start">Start</Label>
            <Input id="sd-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="sd-min">Duration (minutes)</Label>
            <Input id="sd-min" type="number" min={15} step={15} value={minutes} onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={findTime}>
          <Search className="mr-1.5 h-4 w-4" /> Find available time
        </Button>
        {clash && (
          <p className="text-xs font-semibold text-brand-error">
            Overlaps “{clash.title}”. Pick another time or use Find available time.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sd-desc">Description (optional)</Label>
          <Textarea id="sd-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Reminder</Label>
          <Select value={reminder} onValueChange={setReminder}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No reminder</SelectItem>
              <SelectItem value="10">10 minutes before</SelectItem>
              <SelectItem value="15">15 minutes before</SelectItem>
              <SelectItem value="30">30 minutes before</SelectItem>
              <SelectItem value="60">1 hour before</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={confirm} className="bg-brand-lavender text-white hover:bg-brand-lavender/90">
          <CalendarPlus className="mr-1.5 h-4 w-4" /> {session ? "Confirm new time" : "Confirm & add to calendar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
