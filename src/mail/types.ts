/** The mailbox an email arrived on. */
export type MailProvider = "gmail" | "outlook";

/** A mail message normalized to a common shape, regardless of which provider it came from. */
export interface NormalizedEmail {
  provider: MailProvider;
  id: string;
  from: string;
  /**
   * Sender display name when the provider gives it separately from the address.
   * Gmail's raw From header already carries it, so only Outlook sets this.
   */
  fromName?: string;
  subject: string;
  receivedAt: string; // ISO 8601
  /** Plain-text body, truncated to keep Triage input small. Never persisted — see docs/adr/0002. */
  snippet: string;
}

/**
 * Most messages fetched from one provider in one run. Both providers are paged through
 * to the end of the lookback window; this only guards against a runaway window (a
 * mistyped LOOKBACK_HOURS, say), and hitting it is logged rather than silent.
 */
export const MAX_MESSAGES_PER_RUN = 500;
