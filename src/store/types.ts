/**
 * Stored shapes for Phase 2. These mirror the types the web UI consumes
 * (web/src/types.ts) so the API layer is a straight mapping, not a translation.
 * See CONTEXT.md for the terms: Detected Event, Confirmation, Target Calendar.
 */
import type { MailProvider } from "../mail/types.js";

export type DetectedEventStatus = "pending" | "confirmed" | "ignored";

export interface StoredSummary {
  id: string;
  provider: MailProvider;
  messageId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  /** Summary text only — the original message is never stored (ADR-0002). */
  summaryText: string;
  receivedAt: string;
  createdAt: string;
}

export interface StoredDetectedEvent {
  id: string;
  provider: MailProvider;
  messageId: string;
  /** The Mail Account the email arrived on — decides the default Target Calendar. */
  sourceAccountEmail: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  detectedAt: string;
  status: DetectedEventStatus;
  targetCalendarId: string | null;
  confirmedAt: string | null;
  ignoredAt: string | null;
  providerEventId: string | null;
  providerEventUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}
