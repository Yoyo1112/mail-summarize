import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

/**
 * Schema for Phase 2. Only derived text and event metadata are stored — never raw
 * message bodies (ADR-0002). Message ids are kept so a re-run over an overlapping
 * lookback window does not re-summarise or re-detect the same mail.
 */
const SCHEMA = `
create table if not exists summaries (
  id             text primary key,
  provider       text not null,
  message_id     text not null,
  sender_name    text not null,
  sender_email   text not null,
  subject        text not null,
  summary_text   text not null,
  received_at    text not null,
  created_at     text not null,
  unique (provider, message_id)
);

create table if not exists detected_events (
  id                   text primary key,
  provider             text not null,
  message_id           text not null,
  source_account_email text not null,
  title                text not null,
  starts_at            text not null,
  ends_at              text,
  location             text,
  sender_name          text not null,
  sender_email         text not null,
  subject              text not null,
  detected_at          text not null,
  status               text not null check (status in ('pending', 'confirmed', 'ignored')),
  target_calendar_id   text,
  confirmed_at         text,
  ignored_at           text,
  provider_event_id    text,
  provider_event_url   text,
  error_code           text,
  error_message        text
);

create index if not exists detected_events_status
  on detected_events (status, starts_at);

/*
 * One row per message that has been through detection. Detection is skipped for
 * messages already listed here, so an email producing no event is not re-examined
 * on every run. Kept separate from detected_events because one email may yield
 * several events, or none.
 */
create table if not exists processed_messages (
  provider     text not null,
  message_id   text not null,
  processed_at text not null,
  primary key (provider, message_id)
);
`;

let database: DatabaseSync | null = null;

/** Opens the database, creating the file and schema on first use. */
export function db(): DatabaseSync {
  if (database) return database;

  mkdirSync(dirname(config.databasePath), { recursive: true });
  database = new DatabaseSync(config.databasePath);
  database.exec("pragma journal_mode = wal");
  database.exec("pragma foreign_keys = on");
  database.exec(SCHEMA);
  return database;
}

export function closeDb(): void {
  database?.close();
  database = null;
}
