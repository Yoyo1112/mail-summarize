/**
 * Shapes shared by the calendar writers and the API. They mirror web/src/types.ts
 * (Calendar, ConfirmError) so the API layer maps nothing.
 */

export type CalendarProvider = "google" | "outlook";

/** A calendar reachable through one of the connected Mail Accounts (CONTEXT.md: Target Calendar). */
export interface Calendar {
  /** Provider-qualified, e.g. "google:primary", so ids from different providers never collide. */
  id: string;
  provider: CalendarProvider;
  displayName: string;
  accountEmail: string;
}

/** The typed failures a Confirmation can return, per the handoff's API contract. */
export type ConfirmErrorCode = "token_expired" | "quota_exceeded" | "missing_scope" | "network";

export interface ConfirmError {
  code: ConfirmErrorCode;
  /** Shown on the card, e.g. "Could not write · token expired". */
  message: string;
  /** Raw provider detail, e.g. "401 invalid_grant · 14:03:22". */
  diagnostic?: string;
}

/** A failure that already knows how to present itself to the User. */
export class CalendarWriteError extends Error {
  constructor(readonly detail: ConfirmError) {
    super(`${detail.message}${detail.diagnostic ? ` (${detail.diagnostic})` : ""}`);
    this.name = "CalendarWriteError";
  }
}

/** What gets written for a Confirmation. */
export interface CalendarEventInput {
  /** The Detected Event's id — stored on the calendar event so a retried write is not duplicated. */
  detectedEventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
}

export interface WrittenEvent {
  providerEventId: string;
  providerEventUrl: string | null;
}
