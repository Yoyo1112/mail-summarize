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
