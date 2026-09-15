import { google } from "googleapis";
import { config } from "../config.js";
import { forgetGoogleScopes, googleAuth, googleScopes } from "../google-auth.js";
import { getGmailAccountEmail } from "../mail/gmail.js";
import {
  CalendarWriteError,
  type Calendar,
  type CalendarEventInput,
  type ConfirmError,
  type WrittenEvent,
} from "./types.js";

/** Writing events. Deliberately not the full `calendar` scope — this app never edits calendars. */
export const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
/** Listing calendars for the picker. `calendar.events` alone cannot read the calendar list. */
export const GOOGLE_CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

/** The connected account's own calendar — the default Target Calendar for Gmail mail. */
export const GOOGLE_PRIMARY_CALENDAR_ID = "google:primary";

/** The private extended property that ties a calendar event back to its Detected Event. */
const DETECTED_EVENT_PROPERTY = "mailDigestDetectedEventId";

function calendarApi() {
  return google.calendar({ version: "v3", auth: googleAuth() });
}

export async function hasGoogleCalendarAccess(): Promise<boolean> {
  const scopes = await googleScopes();
  return scopes.includes(GOOGLE_CALENDAR_WRITE_SCOPE) && scopes.includes(GOOGLE_CALENDAR_LIST_SCOPE);
}

/**
 * The Google calendars the connected account can write to. The account's own calendar
 * is listed as "google:primary", which is the default Target Calendar for Gmail mail.
 */
export async function listGoogleCalendars(): Promise<Calendar[]> {
  try {
    const [accountEmail, list] = await Promise.all([
      getGmailAccountEmail(),
      calendarApi().calendarList.list({ minAccessRole: "writer" }),
    ]);

    const calendars = (list.data.items ?? []).map((item) => ({
      id: item.primary ? GOOGLE_PRIMARY_CALENDAR_ID : `google:${item.id}`,
      provider: "google" as const,
      displayName: item.primary ? accountEmail : (item.summaryOverride ?? item.summary ?? item.id ?? ""),
      accountEmail,
      primary: Boolean(item.primary),
    }));

    // Own calendar first, so a picker that falls back to its first entry lands on the default.
    return calendars
      .sort((a, b) => Number(b.primary) - Number(a.primary))
      .map(({ primary: _primary, ...calendar }) => calendar);
  } catch (error) {
    throw toCalendarWriteError(error);
  }
}

function googleCalendarId(calendarId: string): string {
  return calendarId.slice("google:".length);
}

/**
 * Writes a confirmed event and returns what the provider created.
 *
 * Idempotent per Detected Event: the event carries the Detected Event's id as a private
 * property, and an existing one is returned instead of writing a second. A confirm whose
 * response was lost (a timeout after Google had already written) can be retried safely.
 */
export async function insertGoogleEvent(calendarId: string, input: CalendarEventInput): Promise<WrittenEvent> {
  const api = calendarApi();
  const target = googleCalendarId(calendarId);

  try {
    const existing = await api.events.list({
      calendarId: target,
      privateExtendedProperty: [`${DETECTED_EVENT_PROPERTY}=${input.detectedEventId}`],
      maxResults: 1,
    });
    const found = existing.data.items?.[0];
    if (found?.id) return { providerEventId: found.id, providerEventUrl: found.htmlLink ?? null };

    const created = await api.events.insert({
      calendarId: target,
      requestBody: {
        summary: input.title,
        location: input.location ?? undefined,
        description: provenance(input),
        start: { dateTime: input.startsAt, timeZone: config.timezone },
        // A deadline has no end; write it as a moment rather than inventing a duration.
        end: { dateTime: input.endsAt ?? input.startsAt, timeZone: config.timezone },
        extendedProperties: { private: { [DETECTED_EVENT_PROPERTY]: input.detectedEventId } },
      },
    });

    if (!created.data.id) {
      throw new CalendarWriteError({ code: "network", message: "Could not write · Google returned no event id" });
    }
    return { providerEventId: created.data.id, providerEventUrl: created.data.htmlLink ?? null };
  } catch (error) {
    throw toCalendarWriteError(error);
  }
}

/** Deletes a previously written event. One already gone counts as deleted. */
export async function deleteGoogleEvent(calendarId: string, providerEventId: string): Promise<void> {
  try {
    await calendarApi().events.delete({ calendarId: googleCalendarId(calendarId), eventId: providerEventId });
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 410) return;
    throw toCalendarWriteError(error);
  }
}

/** What the calendar event says about where it came from. The email body is never stored, so this is all there is. */
function provenance(input: CalendarEventInput): string {
  const sender = input.senderName && input.senderName !== input.senderEmail
    ? `${input.senderName} <${input.senderEmail}>`
    : input.senderEmail;
  return [`Added by Mail Digest from an email.`, `From: ${sender}`, `Subject: ${input.subject}`].join("\n");
}

const QUOTA_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "dailyLimitExceeded"]);
const SCOPE_REASONS = new Set(["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT", "forbidden"]);
const DISABLED_REASONS = new Set(["accessNotConfigured", "SERVICE_DISABLED"]);

/** Maps a googleapis failure onto the four error codes the UI knows how to show. */
function toCalendarWriteError(error: unknown): CalendarWriteError {
  if (error instanceof CalendarWriteError) return error;

  const response = (error as { response?: { status?: number; data?: any } }).response;
  const at = new Date().toLocaleTimeString("en-GB", { timeZone: config.timezone, hour12: false });

  if (!response) {
    const code = (error as { code?: string }).code;
    return new CalendarWriteError({
      code: "network",
      message: "Could not write · Google Calendar could not be reached",
      diagnostic: `${code ?? (error as Error)?.message ?? "no response"} · ${at}`,
    });
  }

  const status = response.status ?? 0;
  const data = response.data ?? {};
  const reason: string | undefined =
    (typeof data.error === "string" ? data.error : undefined) ??
    data.error?.errors?.[0]?.reason ??
    data.error?.details?.find?.((detail: { reason?: string }) => detail.reason)?.reason ??
    data.error?.status;
  const diagnostic = `${status} ${reason ?? "error"} · ${at}`;

  const detail = ((): ConfirmError => {
    if (reason === "invalid_grant" || status === 401) {
      return { code: "token_expired", message: "Could not write · token expired", diagnostic };
    }
    if (status === 429 || (reason && QUOTA_REASONS.has(reason))) {
      return { code: "quota_exceeded", message: "Could not write · Google Calendar quota reached", diagnostic };
    }
    if (reason && DISABLED_REASONS.has(reason)) {
      return {
        code: "missing_scope",
        message: "Could not write · Google Calendar API is not enabled for this Cloud project",
        diagnostic,
      };
    }
    if (status === 403 && (!reason || SCOPE_REASONS.has(reason))) {
      forgetGoogleScopes();
      return { code: "missing_scope", message: "Could not write · calendar access not granted", diagnostic };
    }
    return { code: "network", message: "Could not write · Google Calendar rejected the event", diagnostic };
  })();

  return new CalendarWriteError(detail);
}
