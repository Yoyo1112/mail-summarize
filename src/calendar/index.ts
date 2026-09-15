import { deleteGoogleEvent, insertGoogleEvent } from "./google.js";
import { CalendarWriteError, type CalendarEventInput, type WrittenEvent } from "./types.js";

/**
 * Routes a write to the provider its Target Calendar belongs to, by the id's prefix.
 * Only Google is implemented; see src/api/calendars.ts for why Outlook is not yet.
 */
export async function writeEvent(calendarId: string, input: CalendarEventInput): Promise<WrittenEvent> {
  if (calendarId.startsWith("google:")) return insertGoogleEvent(calendarId, input);
  throw unsupported(calendarId);
}

export async function deleteEvent(calendarId: string, providerEventId: string): Promise<void> {
  if (calendarId.startsWith("google:")) return deleteGoogleEvent(calendarId, providerEventId);
  throw unsupported(calendarId);
}

function unsupported(calendarId: string): CalendarWriteError {
  return new CalendarWriteError({
    code: "missing_scope",
    message: "Could not write · no calendar access for this account",
    diagnostic: calendarId ? `unsupported calendar ${calendarId}` : "no target calendar",
  });
}
