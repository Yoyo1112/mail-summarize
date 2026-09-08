import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import type { DetectedEventStatus, StoredDetectedEvent, StoredSummary } from "./types.js";
import type { MailProvider } from "../mail/types.js";

/**
 * `node:sqlite` types every row as `Record<string, SQLOutputValue>`, so reading a row
 * as its column shape needs an explicit widening. Confined to this one helper — the
 * schema in db.ts is what actually guarantees the shape.
 */
function rows<T>(result: unknown[]): T[] {
  return result as T[];
}

/** Row shape as SQLite returns it — snake_case, and nullable columns as null. */
interface EventRow {
  id: string;
  provider: string;
  message_id: string;
  source_account_email: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  sender_name: string;
  sender_email: string;
  subject: string;
  detected_at: string;
  status: string;
  target_calendar_id: string | null;
  confirmed_at: string | null;
  ignored_at: string | null;
  provider_event_id: string | null;
  provider_event_url: string | null;
  error_code: string | null;
  error_message: string | null;
}

function toEvent(row: EventRow): StoredDetectedEvent {
  return {
    id: row.id,
    provider: row.provider as MailProvider,
    messageId: row.message_id,
    sourceAccountEmail: row.source_account_email,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    subject: row.subject,
    detectedAt: row.detected_at,
    status: row.status as DetectedEventStatus,
    targetCalendarId: row.target_calendar_id,
    confirmedAt: row.confirmed_at,
    ignoredAt: row.ignored_at,
    providerEventId: row.provider_event_id,
    providerEventUrl: row.provider_event_url,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

export type NewSummary = Omit<StoredSummary, "id" | "createdAt">;

/**
 * Inserts a Summary, ignoring a message already summarised on an earlier run.
 * Returns true when a row was actually written.
 */
export function saveSummary(summary: NewSummary): boolean {
  const result = db()
    .prepare(
      `insert or ignore into summaries
         (id, provider, message_id, sender_name, sender_email, subject, summary_text, received_at, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      summary.provider,
      summary.messageId,
      summary.senderName,
      summary.senderEmail,
      summary.subject,
      summary.summaryText,
      summary.receivedAt,
      new Date().toISOString(),
    );

  return result.changes > 0;
}

export type NewDetectedEvent = Pick<
  StoredDetectedEvent,
  | "provider"
  | "messageId"
  | "sourceAccountEmail"
  | "title"
  | "startsAt"
  | "endsAt"
  | "location"
  | "senderName"
  | "senderEmail"
  | "subject"
>;

/** Inserts a Detected Event in the Pending state. Nothing is written to a calendar. */
export function saveDetectedEvent(event: NewDetectedEvent): StoredDetectedEvent {
  const id = randomUUID();
  const detectedAt = new Date().toISOString();

  db()
    .prepare(
      `insert into detected_events
         (id, provider, message_id, source_account_email, title, starts_at, ends_at,
          location, sender_name, sender_email, subject, detected_at, status)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      id,
      event.provider,
      event.messageId,
      event.sourceAccountEmail,
      event.title,
      event.startsAt,
      event.endsAt,
      event.location,
      event.senderName,
      event.senderEmail,
      event.subject,
      detectedAt,
    );

  return {
    ...event,
    id,
    detectedAt,
    status: "pending",
    targetCalendarId: null,
    confirmedAt: null,
    ignoredAt: null,
    providerEventId: null,
    providerEventUrl: null,
    errorCode: null,
    errorMessage: null,
  };
}

/** Message ids already put through detection, so a re-run does not re-examine them. */
export function filterUnprocessed(
  provider: MailProvider,
  messageIds: string[],
): string[] {
  if (messageIds.length === 0) return [];

  const placeholders = messageIds.map(() => "?").join(", ");
  const existing = db()
    .prepare(
      `select message_id from processed_messages
       where provider = ? and message_id in (${placeholders})`,
    )
    .all(provider, ...messageIds);
  const seenRows = rows<{ message_id: string }>(existing);

  const seen = new Set(seenRows.map((row) => row.message_id));
  return messageIds.filter((id) => !seen.has(id));
}

export function markProcessed(provider: MailProvider, messageIds: string[]): void {
  const statement = db().prepare(
    `insert or ignore into processed_messages (provider, message_id, processed_at)
     values (?, ?, ?)`,
  );
  const now = new Date().toISOString();
  for (const messageId of messageIds) {
    statement.run(provider, messageId, now);
  }
}

export function getEvent(id: string): StoredDetectedEvent | null {
  const row = db().prepare(`select * from detected_events where id = ?`).get(id);
  return row ? toEvent(row as unknown as EventRow) : null;
}

/**
 * Dismissal — the event stops appearing among Pending. Nothing is written to a
 * calendar and the record is not removed (CONTEXT.md: Dismissal).
 */
export function ignoreEvent(id: string): StoredDetectedEvent | null {
  db()
    .prepare(
      `update detected_events
          set status = 'ignored', ignored_at = ?, error_code = null, error_message = null
        where id = ? and status != 'confirmed'`,
    )
    .run(new Date().toISOString(), id);
  return getEvent(id);
}

/** Restore a dismissed event, or Undo a Confirmation — both return it to Pending. */
export function restoreEvent(id: string): StoredDetectedEvent | null {
  db()
    .prepare(
      `update detected_events
          set status = 'pending', ignored_at = null, confirmed_at = null,
              provider_event_id = null, provider_event_url = null,
              error_code = null, error_message = null
        where id = ?`,
    )
    .run(id);
  return getEvent(id);
}

/** Records which calendar a Confirmation should write to. */
export function setTargetCalendar(id: string, calendarId: string): StoredDetectedEvent | null {
  db()
    .prepare(`update detected_events set target_calendar_id = ? where id = ?`)
    .run(calendarId, id);
  return getEvent(id);
}

export function listEventsByStatus(status: DetectedEventStatus): StoredDetectedEvent[] {
  const result = db()
    .prepare(`select * from detected_events where status = ? order by starts_at asc`)
    .all(status);
  return rows<EventRow>(result).map(toEvent);
}

interface SummaryRow {
  id: string;
  provider: string;
  message_id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  summary_text: string;
  received_at: string;
  created_at: string;
}

export function listRecentSummaries(limit = 50): StoredSummary[] {
  const result = db()
    .prepare(`select * from summaries order by received_at desc limit ?`)
    .all(limit);

  return rows<SummaryRow>(result).map((row) => ({
    id: row.id,
    provider: row.provider as MailProvider,
    messageId: row.message_id,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    subject: row.subject,
    summaryText: row.summary_text,
    receivedAt: row.received_at,
    createdAt: row.created_at,
  }));
}

export function setMeta(key: string, value: string): void {
  db()
    .prepare(`insert into meta (key, value) values (?, ?)
              on conflict(key) do update set value = excluded.value`)
    .run(key, value);
}

export function getMeta(key: string): string | null {
  const row = db().prepare(`select value from meta where key = ?`).get(key);
  return (row as { value: string } | undefined)?.value ?? null;
}

/** When the pipeline last completed a run — the page's freshness line. */
export const LAST_RUN_AT = "last_run_at";

export function countEventsByStatus(status: DetectedEventStatus): number {
  const row = db()
    .prepare(`select count(*) as n from detected_events where status = ?`)
    .get(status);
  return Number((row as { n: number } | undefined)?.n ?? 0);
}

export function countSummaries(): number {
  const row = db().prepare(`select count(*) as n from summaries`).get();
  return Number((row as { n: number } | undefined)?.n ?? 0);
}
