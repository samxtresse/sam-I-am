import { googleFetch, isGoogleStub } from "@/lib/google";

type Input = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const STUB_EVENTS = [
  {
    id: "stub_evt_1",
    summary: "[stub] Standup",
    start: { dateTime: addMinutes(new Date(), 60).toISOString() },
    end: { dateTime: addMinutes(new Date(), 90).toISOString() },
    attendees: [{ email: "team@xtresse.com" }],
  },
  {
    id: "stub_evt_2",
    summary: "[stub] Investor coffee",
    start: { dateTime: addMinutes(new Date(), 60 * 26).toISOString() },
    end: { dateTime: addMinutes(new Date(), 60 * 27).toISOString() },
    location: "Sightglass · SF",
  },
];

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

export async function listCalendarEvents(input: Input): Promise<string> {
  const timeMin = str(input.time_min) || new Date().toISOString();
  const timeMax =
    str(input.time_max) || addMinutes(new Date(timeMin), 60 * 24 * 7).toISOString();
  const maxResults = num(input.max_results, 20);

  if (isGoogleStub()) {
    return JSON.stringify({ stub_mode: true, events: STUB_EVENTS });
  }

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const data = (await googleFetch(url.toString())) as { items?: unknown[] };
  return JSON.stringify({ events: data.items ?? [] });
}

export async function findFreeSlots(input: Input): Promise<string> {
  const duration = num(input.duration_minutes, 30);
  const timeMin = str(input.time_min);
  const timeMax = str(input.time_max);
  if (!timeMin || !timeMax) return JSON.stringify({ error: "time_min and time_max required" });

  const wh = (input.working_hours as Record<string, unknown> | undefined) ?? {};
  const startHour = num(wh.start_hour, 9);
  const endHour = num(wh.end_hour, 18);

  if (isGoogleStub()) {
    // Generate plausible 30-min slot suggestions across the window.
    const slots: { start: string; end: string }[] = [];
    let cursor = new Date(timeMin);
    const end = new Date(timeMax);
    while (cursor < end && slots.length < 5) {
      const h = cursor.getHours();
      if (h >= startHour && h + duration / 60 <= endHour && cursor.getDay() % 6 !== 0) {
        slots.push({
          start: cursor.toISOString(),
          end: addMinutes(cursor, duration).toISOString(),
        });
      }
      cursor = addMinutes(cursor, 60);
    }
    return JSON.stringify({ stub_mode: true, slots });
  }

  const fb = (await googleFetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  })) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };

  const busy = fb.calendars?.primary?.busy ?? [];
  const slots: { start: string; end: string }[] = [];
  let cursor = new Date(timeMin);
  const end = new Date(timeMax);
  while (cursor < end && slots.length < 8) {
    const slotEnd = addMinutes(cursor, duration);
    const h = cursor.getHours();
    const inHours = h >= startHour && slotEnd.getHours() <= endHour;
    const overlaps = busy.some(
      (b) => new Date(b.start) < slotEnd && new Date(b.end) > cursor,
    );
    if (inHours && !overlaps && cursor.getDay() % 6 !== 0) {
      slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
    }
    cursor = addMinutes(cursor, 30);
  }
  return JSON.stringify({ slots });
}

export async function createCalendarEvent(input: Input): Promise<string> {
  const title = str(input.title);
  const start = str(input.start);
  const end = str(input.end);
  if (!title || !start || !end) {
    return JSON.stringify({ error: "title, start, end required" });
  }
  const attendeesRaw = Array.isArray(input.attendees) ? (input.attendees as unknown[]) : [];
  const attendees = attendeesRaw.filter((a): a is string => typeof a === "string");

  if (isGoogleStub()) {
    return JSON.stringify({
      stub_mode: true,
      created: { title, start, end, attendees, id: `stub_${Date.now()}` },
    });
  }

  const data = (await googleFetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      body: JSON.stringify({
        summary: title,
        start: { dateTime: start },
        end: { dateTime: end },
        description: str(input.description),
        location: str(input.location),
        attendees: attendees.map((email) => ({ email })),
      }),
    },
  )) as { id: string; htmlLink?: string };

  return JSON.stringify({ created: { id: data.id, link: data.htmlLink } });
}
