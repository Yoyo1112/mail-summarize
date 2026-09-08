/**
 * Domain types for the Phase 2 review UI. Names follow CONTEXT.md — Detected Event,
 * Confirmation, Dismissal, Target Calendar — and `MailProvider` matches the
 * `provider` field already used by NormalizedEmail in the backend (src/mail/types.ts).
 */

/** The mailbox an email arrived on. Mirrors NormalizedEmail["provider"]. */
export type MailProvider = "gmail" | "outlook";

/** The calendar side of a provider. Gmail mail maps to a Google calendar. */
export type CalendarProvider = "google" | "outlook";

/**
 * The three states a Detected Event moves through (CONTEXT.md). Pending is the
 * starting state; Confirmation and Dismissal are the only ways out, and both are
 * terminal in the domain — Undo/Restore are UI affordances that reopen the record,
 * not a fourth state.
 */
export type DetectedEventStatus = "pending" | "confirmed" | "ignored";

/** Typed failures a confirm can return, per the handoff's API contract. */
export type ConfirmErrorCode = "token_expired" | "quota_exceeded" | "missing_scope" | "network";

export interface ConfirmError {
  code: ConfirmErrorCode;
  /** Human-readable line shown on the card, e.g. "Could not write · token expired". */
  message: string;
  /** Raw provider diagnostic, e.g. "401 invalid_grant · 14:03:22". Optional. */
  diagnostic?: string;
}

/**
 * A calendar event extracted from an email during Triage. Never written to a
 * calendar automatically — a Confirmation is always required (ADR-0003).
 */
export interface DetectedEvent {
  id: string;
  title: string;
  /** ISO 8601 with offset. */
  startsAt: string;
  /** ISO 8601 with offset, or null when the email gave no end time. */
  endsAt: string | null;
  /** Null when detection found no location. The absence is shown, never hidden. */
  location: string | null;
  source: MailProvider;
  senderName: string;
  senderEmail: string;
  subject: string;
  /** ISO 8601 — when Triage extracted this event. */
  detectedAt: string;
  status: DetectedEventStatus;
  /** Calendar this will be (or was) written to. Defaults to the same-provider calendar. */
  targetCalendarId: string;
  /** Set when a confirm failed; the card keeps the failure instead of dropping it. */
  error: ConfirmError | null;
  /** Set once confirmed, for the "Added to Google · work@acme.co" result line. */
  confirmedAt?: string;
  /** Set once ignored, for the "you dismissed this · 13:58" line. */
  ignoredAt?: string;
}

/** The condensed description of one email that passed Triage. */
export interface Summary {
  id: string;
  source: MailProvider;
  senderName: string;
  senderEmail: string;
  subject: string;
  /** Summary text only — original message bodies are never stored (ADR-0002). */
  summaryText: string;
  /** ISO 8601. */
  receivedAt: string;
}

/** A calendar reachable through one of the User's connected Mail Accounts. */
export interface Calendar {
  id: string;
  provider: CalendarProvider;
  displayName: string;
  accountEmail: string;
}

/** Which tab of the triage stream is showing. */
export type Tab = "needs-review" | "summaries" | "ignored";
