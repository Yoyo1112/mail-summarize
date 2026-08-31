/** A mail message normalized to a common shape, regardless of which provider it came from. */
export interface NormalizedEmail {
  provider: "gmail" | "outlook";
  id: string;
  from: string;
  subject: string;
  receivedAt: string; // ISO 8601
  /** Plain-text body, truncated to keep Triage input small. Never persisted — see docs/adr/0002. */
  snippet: string;
}
