import type { CalendarProvider, MailProvider } from "../types";

/**
 * Month abbreviations are pinned rather than taken from `month: "short"`: recent ICU
 * renders September as "Sept" in en-GB, and the design calls for "Sep".
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function monthAbbrev(date: Date): string {
  return MONTHS[date.getMonth()] ?? "";
}

function weekdayAbbrev(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
}

/** "Thu 10 Sep 2026" */
export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  return `${weekdayAbbrev(date)} ${day} ${monthAbbrev(date)} ${date.getFullYear()}`;
}

/** "14:00" */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "GMT+8" */
function formatZone(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(iso));
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

/**
 * "14:00 – 15:00 GMT+8" when the email gave an end time, otherwise just "09:30".
 * The zone is only worth the width when a range makes the duration meaningful.
 */
export function formatEventTime(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return formatTime(startsAt);
  return `${formatTime(startsAt)} – ${formatTime(endsAt)} ${formatZone(startsAt)}`.trim();
}

/** "Today" / "Yesterday" / "Mon 8 Sep" — the right-hand column of the summary table. */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (dayDelta === 0) return "Today";
  if (dayDelta === 1) return "Yesterday";
  return `${weekdayAbbrev(date)} ${date.getDate()} ${monthAbbrev(date)}`;
}

/** "2 min ago" / "just now" / "1 hr ago" — for the top-bar sync line. */
export function formatAgo(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
}

/** The calendar a mailbox writes to by default (CONTEXT.md: Target Calendar). */
export function calendarProviderFor(source: MailProvider): CalendarProvider {
  return source === "gmail" ? "google" : "outlook";
}

/** "Google" / "Outlook" — the human label in the calendar picker. */
export function calendarProviderLabel(provider: CalendarProvider): string {
  return provider === "google" ? "Google" : "Outlook";
}
