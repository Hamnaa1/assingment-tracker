import type { Assignment, CalendarEvent, StudySession } from "./types";

/* ---------------- Parsing (read-only calendar subscriptions) ---------------- */

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Parses an ICS date value. UTC (Z) values are exact; TZID/floating values are read as local time. */
export function parseIcsDate(value: string): { date: Date; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)))
    : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return { date, allDay: false };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface RawEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  rrule?: Record<string, string>;
  exdates: number[];
  recurrenceId?: number;
}

/**
 * Parses VEVENTs from an ICS feed and expands simple recurring events
 * (DAILY/WEEKLY with INTERVAL, BYDAY, COUNT, UNTIL) inside [from, to].
 */
export function parseIcs(text: string, feedId: string, from: Date, to: Date): CalendarEvent[] {
  const raws: RawEvent[] = [];
  let cur: Partial<RawEvent> & { exdates?: number[] } | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { cur = { exdates: [] }; continue; }
    if (line === "END:VEVENT") {
      if (cur?.start) {
        const end = cur.end ?? new Date(cur.start.getTime() + (cur.allDay ? 86400000 : 3600000));
        raws.push({ uid: cur.uid ?? Math.random().toString(36).slice(2), title: cur.title || "Busy", start: cur.start, end, allDay: !!cur.allDay, location: cur.location, rrule: cur.rrule, exdates: cur.exdates ?? [], recurrenceId: cur.recurrenceId });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const keyPart = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = keyPart.split(";")[0].toUpperCase();
    if (key === "UID") cur.uid = value;
    else if (key === "SUMMARY") cur.title = unescape(value);
    else if (key === "LOCATION") cur.location = unescape(value) || undefined;
    else if (key === "DTSTART") { const p = parseIcsDate(value); if (p) { cur.start = p.date; cur.allDay = p.allDay; } }
    else if (key === "DTEND") { const p = parseIcsDate(value); if (p) cur.end = p.date; }
    else if (key === "RRULE") cur.rrule = Object.fromEntries(value.split(";").map((kv) => kv.split("=") as [string, string]));
    else if (key === "EXDATE") value.split(",").forEach((v) => { const p = parseIcsDate(v); if (p) cur!.exdates!.push(p.date.getTime()); });
    else if (key === "RECURRENCE-ID") { const p = parseIcsDate(value); if (p) cur.recurrenceId = p.date.getTime(); }
  }

  // Moved/overridden occurrences replace the generated ones.
  const overrides = new Map<string, Set<number>>();
  raws.filter((r) => r.recurrenceId !== undefined).forEach((r) => {
    if (!overrides.has(r.uid)) overrides.set(r.uid, new Set());
    overrides.get(r.uid)!.add(r.recurrenceId!);
  });

  const out: CalendarEvent[] = [];
  const push = (r: RawEvent, start: Date, i: number) => {
    const end = new Date(start.getTime() + (r.end.getTime() - r.start.getTime()));
    if (end < from || start > to) return;
    out.push({ id: `${feedId}:${r.uid}:${i}`, feedId, title: r.title, start: start.toISOString(), end: end.toISOString(), allDay: r.allDay, location: r.location });
  };

  for (const r of raws) {
    if (!r.rrule || r.recurrenceId !== undefined) { push(r, r.start, r.recurrenceId ?? 0); continue; }
    const freq = r.rrule.FREQ;
    if (freq !== "DAILY" && freq !== "WEEKLY") { push(r, r.start, 0); continue; }
    const interval = Math.max(1, parseInt(r.rrule.INTERVAL ?? "1"));
    const count = r.rrule.COUNT ? parseInt(r.rrule.COUNT) : Infinity;
    const until = r.rrule.UNTIL ? parseIcsDate(r.rrule.UNTIL)?.date ?? to : to;
    const limit = until < to ? until : to;
    const byDay = (r.rrule.BYDAY ?? "").split(",").filter(Boolean).map((d) => DAY_CODES.indexOf(d.slice(-2))).filter((d) => d >= 0);
    const skip = new Set([...r.exdates, ...(overrides.get(r.uid) ?? [])]);
    let n = 0;
    for (let day = 0; n < count && day < 800; day++) {
      const occ = new Date(r.start);
      occ.setDate(occ.getDate() + day);
      if (occ > limit) break;
      let match: boolean;
      if (freq === "DAILY") match = day % interval === 0;
      else {
        const week = Math.floor(day / 7);
        const days = byDay.length ? byDay : [r.start.getDay()];
        match = week % interval === 0 && days.includes(occ.getDay());
      }
      if (!match) continue;
      n++;
      if (skip.has(occ.getTime())) continue;
      push(r, occ, n);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/* ---------------- Export (.ics files to add to any calendar) ---------------- */

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");

export function buildIcs(sessions: StudySession[], assignments: Assignment[], includeDeadlines = false): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Momentum//Study Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const stamp = fmt(new Date());
  for (const s of sessions) {
    const a = assignments.find((x) => x.id === s.assignmentId);
    lines.push(
      "BEGIN:VEVENT",
      `UID:momentum-session-${s.id}@momentum`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmt(new Date(s.start))}`,
      `DTEND:${fmt(new Date(s.end))}`,
      `SUMMARY:${esc(`Study: ${s.title}${a ? ` (${a.title})` : ""}`)}`,
      `DESCRIPTION:${esc(s.description || `Momentum study session for ${a?.title ?? "your assignment"}.`)}`,
    );
    if (s.reminderMinutes > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Study session starting", `TRIGGER:-PT${s.reminderMinutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  if (includeDeadlines) {
    for (const a of assignments) {
      const next = new Date(a.deadline + "T00:00:00");
      next.setDate(next.getDate() + 1);
      const nextYmd = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
      lines.push("BEGIN:VEVENT", `UID:momentum-deadline-${a.id}@momentum`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(a.deadline)}`, `DTEND;VALUE=DATE:${nextYmd}`, `SUMMARY:${esc(`Deadline: ${a.title}${a.deadlineTime ? ` (${a.deadlineTime})` : ""}`)}`, "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
