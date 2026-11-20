import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Link2 } from "lucide-react";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleDialog } from "@/components/momentum/ScheduleDialog";
import { useMomentum } from "@/lib/momentum/store";
import { buildIcs, downloadIcs } from "@/lib/momentum/ics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type View = "month" | "week" | "day";
type Kind = "deadline" | "session" | "personal";
interface Item {
  id: string;
  kind: Kind;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  subtitle?: string;
  assignmentId?: string;
  sessionId?: string;
}

const KIND_STYLE: Record<Kind, string> = {
  deadline: "bg-brand-error/15 text-brand-error-text border-brand-error/30",
  session: "bg-brand-lavender text-white border-brand-lavender",
  personal: "bg-muted text-foreground border-border",
};
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00–23:00
const HOUR_PX = 48;

export default function CalendarPage() {
  const { state, dispatch, commit } = useMomentum();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Item | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const a of state.assignments) {
      const d = new Date(a.deadline + "T00:00:00");
      out.push({ id: `d-${a.id}`, kind: "deadline", title: `Due: ${a.title}`, start: d, end: d, allDay: true, subtitle: `${a.module}${a.deadlineTime ? ` · ${a.deadlineTime}` : ""}`, assignmentId: a.id });
    }
    for (const s of state.studySessions ?? []) {
      const a = state.assignments.find((x) => x.id === s.assignmentId);
      out.push({ id: `s-${s.id}`, kind: "session", title: s.title, start: new Date(s.start), end: new Date(s.end), allDay: false, subtitle: a?.title, assignmentId: s.assignmentId, sessionId: s.id });
    }
    for (const e of state.calendarEvents ?? []) {
      out.push({ id: `e-${e.id}`, kind: "personal", title: e.title, start: new Date(e.start), end: new Date(e.end), allDay: e.allDay, subtitle: e.location });
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [state.assignments, state.studySessions, state.calendarEvents]);

  const onDay = (day: Date) =>
    items.filter((i) => (i.allDay ? i.start <= day && (isSameDay(i.start, day) || i.end > day) && !(i.kind === "personal" && isSameDay(i.end, day) && !isSameDay(i.start, day)) : isSameDay(i.start, day)));

  const step = (dir: 1 | -1) => setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
  const days = view === "day" ? [startOfDay(cursor)] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, { weekStartsOn: 1 }), i));
  const title = view === "month" ? format(cursor, "MMMM yyyy") : view === "week" ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}` : format(cursor, "EEEE d MMMM yyyy");

  const upcoming = items.filter((i) => i.kind !== "personal" && i.end >= startOfDay(new Date())).slice(0, 8);
  const selectedSession = selected?.sessionId ? (state.studySessions ?? []).find((s) => s.id === selected.sessionId) : undefined;
  const selectedAssignment = selected?.assignmentId ? state.assignments.find((a) => a.id === selected.assignmentId) : undefined;
  const noFeeds = (state.calendarFeeds ?? []).length === 0;

  const Chip = ({ item, compact }: { item: Item; compact?: boolean }) => (
    <button
      onClick={() => setSelected(item)}
      className={cn("w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-semibold", KIND_STYLE[item.kind])}
      title={item.title}
    >
      {!item.allDay && !compact && <span className="mr-1 opacity-80">{format(item.start, "HH:mm")}</span>}
      {item.title}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Deadlines, study sessions and your own commitments in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadIcs("momentum-study-plan.ics", buildIcs(state.studySessions ?? [], state.assignments, true))}>
            <Download className="mr-1.5 h-4 w-4" /> Export to my calendar
          </Button>
          <Button asChild variant="outline" size="sm"><Link to="/settings#calendars"><Link2 className="mr-1.5 h-4 w-4" /> Connect calendar</Link></Button>
        </div>
      </div>

      {noFeeds && (
        <Card className="border-brand-lavender/30 bg-brand-soft-purple/50 shadow-sm">
          <CardContent className="p-4 text-sm text-brand-charcoal">
            Connect Google, Outlook or Apple Calendar in <Link to="/settings#calendars" className="font-bold underline">Settings</Link> so Momentum can see your lectures and shifts and plan around them. Optional — everything works without it.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
              <Button variant="ghost" size="icon" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
              <span className="ml-2 text-sm font-bold">{title}</span>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="day">Day</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="border-b p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
              {(() => {
                const cells: Date[] = [];
                for (let d = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }); d <= endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }); d = addDays(d, 1)) cells.push(d);
                return cells.map((d) => {
                  const list = onDay(d);
                  return (
                    <div key={d.toISOString()} className={cn("min-h-24 border-b border-r p-1", !isSameMonth(d, cursor) && "bg-muted/30")}>
                      <button onClick={() => { setCursor(d); setView("day"); }} className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", isSameDay(d, new Date()) ? "bg-brand-lavender text-white" : "text-muted-foreground")}>
                        {format(d, "d")}
                      </button>
                      <div className="flex flex-col gap-0.5">
                        {list.slice(0, 3).map((i) => <Chip key={i.id} item={i} />)}
                        {list.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</span>}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]" style={view === "day" ? { minWidth: 0 } : undefined}>
                <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                  <div />
                  {days.map((d) => (
                    <div key={d.toISOString()} className="border-l p-1.5">
                      <p className={cn("text-center text-xs font-semibold", isSameDay(d, new Date()) ? "text-brand-lavender" : "text-muted-foreground")}>{format(d, "EEE d")}</p>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {onDay(d).filter((i) => i.allDay).map((i) => <Chip key={i.id} item={i} />)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                  <div>
                    {HOURS.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[11px] text-muted-foreground">{String(h).padStart(2, "0")}:00</div>)}
                  </div>
                  {days.map((d) => (
                    <div key={d.toISOString()} className="relative border-l">
                      {HOURS.map((h) => <div key={h} style={{ height: HOUR_PX }} className="border-b border-dashed border-border/60" />)}
                      {onDay(d).filter((i) => !i.allDay).map((i) => {
                        const startH = i.start.getHours() + i.start.getMinutes() / 60;
                        const endH = Math.max(startH + 0.4, (i.end.getTime() - startOfDay(d).getTime()) / 3600000);
                        const top = Math.max(0, (startH - HOURS[0]) * HOUR_PX);
                        const height = Math.max(18, (Math.min(endH, HOURS[HOURS.length - 1] + 1) - Math.max(startH, HOURS[0])) * HOUR_PX);
                        return (
                          <button key={i.id} onClick={() => setSelected(i)} style={{ top, height }} className={cn("absolute inset-x-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold", KIND_STYLE[i.kind])}>
                            <p className="truncate">{i.title}</p>
                            <p className="truncate font-normal opacity-80">{format(i.start, "HH:mm")}–{format(i.end, "HH:mm")}</p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm font-bold">Key</p>
              {(["session", "deadline", "personal"] as Kind[]).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className={cn("h-3 w-3 rounded border", KIND_STYLE[k])} />
                  {k === "session" ? "Momentum study session" : k === "deadline" ? "Assignment deadline" : "Your calendar events"}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm font-bold">Coming up</p>
              {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Nothing scheduled yet. Open an assignment and use “Schedule around my calendar”.</p>}
              {upcoming.map((i) => (
                <button key={i.id} onClick={() => setSelected(i)} className="flex flex-col rounded-md p-1.5 text-left hover:bg-muted/60">
                  <span className="truncate text-xs font-semibold">{i.title}</span>
                  <span className="text-[11px] text-muted-foreground">{i.allDay ? format(i.start, "EEE d MMM") : format(i.start, "EEE d MMM · HH:mm")}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setRescheduling(false); } }}>
        {selected && rescheduling && selectedSession && selectedAssignment ? (
          <ScheduleDialog assignment={selectedAssignment} session={selectedSession} onDone={() => { setSelected(null); setRescheduling(false); }} />
        ) : selected ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>
                {selected.allDay ? format(selected.start, "EEEE d MMMM yyyy") : `${format(selected.start, "EEEE d MMMM · HH:mm")}–${format(selected.end, "HH:mm")}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <Badge variant="outline" className={cn("w-fit", KIND_STYLE[selected.kind])}>
                {selected.kind === "session" ? "Momentum study session" : selected.kind === "deadline" ? "Deadline" : "From your calendar (read-only)"}
              </Badge>
              {selected.subtitle && <p className="text-muted-foreground">{selected.subtitle}</p>}
              {selectedSession?.description && <p>{selectedSession.description}</p>}
              {selectedSession && <p className="text-xs text-muted-foreground">Reminder: {selectedSession.reminderMinutes ? `${selectedSession.reminderMinutes} min before` : "none"}</p>}
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:gap-0">
              {selectedAssignment && <Button asChild variant="outline"><Link to={`/assignments/${selectedAssignment.id}`}>Open assignment</Link></Button>}
              {selectedSession && selectedAssignment && (
                <>
                  <Button variant="outline" onClick={() => downloadIcs("momentum-session.ics", buildIcs([selectedSession], [selectedAssignment]))}><Download className="mr-1.5 h-4 w-4" /> .ics</Button>
                  <Button variant="outline" onClick={() => setRescheduling(true)}>Reschedule</Button>
                  <Button
                    variant="outline"
                    className="text-brand-error-text hover:text-brand-error-text"
                    onClick={() => {
                      if (!window.confirm("Remove this study session from your Momentum calendar?")) return;
                      const save = async () => { try { await commit({ type: "deleteStudySession", id: selectedSession.id }); toast.success("Study session removed"); setSelected(null); } catch { toast.error("Couldn't remove the session — check your connection.", { action: { label: "Retry", onClick: () => void save() } }); } }; void save();
                    }}
                  >
                    Remove
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
