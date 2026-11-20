import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { parseIcs } from "./ics";
import type { CalendarEvent, CalendarFeed } from "./types";

/** Reads a private calendar link through the backend and parses its events (2 weeks back, 4 months ahead). */
export async function fetchFeedEvents(feed: Pick<CalendarFeed, "id" | "url">): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.functions.invoke("calendar-feed", { body: { url: feed.url } });
  if (error) {
    let msg = "Couldn't sync this calendar.";
    if (error instanceof FunctionsHttpError) {
      try {
        msg = (await error.context.json()).error ?? msg;
      } catch {
        /* keep default */
      }
    }
    throw new Error(msg);
  }
  const from = new Date(Date.now() - 14 * 86400000);
  const to = new Date(Date.now() + 120 * 86400000);
  return parseIcs(data.ics as string, feed.id, from, to);
}

export const PROVIDER_INFO = {
  google: {
    name: "Google Calendar",
    steps: "Google Calendar on the web → Settings → pick your calendar → Integrate calendar → copy “Secret address in iCal format”.",
  },
  outlook: {
    name: "Microsoft Outlook Calendar",
    steps: "Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → choose “Can view all details” → copy the ICS link.",
  },
  apple: {
    name: "Apple Calendar (iCloud)",
    steps: "iCloud Calendar or the Calendar app → share the calendar → turn on “Public Calendar” → copy the webcal:// link.",
  },
  other: { name: "Other calendar", steps: "Paste any iCal / ICS subscription link." },
} as const;
