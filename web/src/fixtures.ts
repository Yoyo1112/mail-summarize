/**
 * Fixture data reproducing the handoff prototype's sample content.
 *
 * This stands in for the API described in the handoff until Phase 2's backend
 * exists (GET /events, GET /summaries, GET /calendars). Replace with real fetches;
 * the shapes here are the shapes those endpoints are specified to return.
 */
import type { Calendar, DetectedEvent, Summary } from "./types";

export const CALENDARS: Calendar[] = [
  { id: "g-work", provider: "google", displayName: "work@acme.co", accountEmail: "work@acme.co" },
  {
    id: "g-personal",
    provider: "google",
    displayName: "personal@gmail.com",
    accountEmail: "personal@gmail.com",
  },
  // A shared calendar reached through the work account — display name and account differ.
  { id: "g-family", provider: "google", displayName: "Family", accountEmail: "work@acme.co" },
  { id: "o-lin", provider: "outlook", displayName: "lin@outlook.com", accountEmail: "lin@outlook.com" },
  {
    id: "o-team",
    provider: "outlook",
    displayName: "Acme Team Events",
    accountEmail: "lin@outlook.com",
  },
];

export const DETECTED_EVENTS: DetectedEvent[] = [
  {
    id: "e1",
    title: "Design review — Q4 roadmap",
    startsAt: "2026-09-10T14:00:00+08:00",
    endsAt: "2026-09-10T15:00:00+08:00",
    location: "Acme HQ · Room 7B, 12F",
    source: "gmail",
    sourceAccountEmail: "work@acme.co",
    senderName: "Priya Raman",
    senderEmail: "priya@acme.co",
    subject: "Re: Q4 roadmap review — moving to Thursday",
    detectedAt: "2026-09-08T14:00:00+08:00",
    status: "pending",
    targetCalendarId: "g-work",
    error: null,
  },
  {
    id: "e2",
    title: "Vet appointment — Mochi's annual checkup",
    startsAt: "2026-09-12T09:30:00+08:00",
    endsAt: null,
    location: null,
    source: "outlook",
    sourceAccountEmail: "lin@outlook.com",
    senderName: "Taipei Vet Clinic",
    senderEmail: "no-reply@vetclinic.tw",
    subject: "Appointment confirmation #48812",
    detectedAt: "2026-09-08T14:00:00+08:00",
    status: "pending",
    targetCalendarId: "o-lin",
    error: null,
  },
];

export const SUMMARIES: Summary[] = [
  {
    id: "s1",
    source: "gmail",
    senderName: "Priya Raman",
    senderEmail: "priya@acme.co",
    subject: "Re: Q4 roadmap review — moving to Thursday",
    summaryText:
      "Priya moved the roadmap review to Thursday 10 Sep, 14:00–15:00 at Acme HQ Room 7B. She asks you to bring the revised pricing slide; Dan will cover the infra section.",
    receivedAt: "2026-09-08T09:41:00+08:00",
  },
  {
    id: "s2",
    source: "outlook",
    senderName: "Taipei Vet Clinic",
    senderEmail: "no-reply@vetclinic.tw",
    subject: "Appointment confirmation #48812",
    summaryText:
      "Mochi's annual checkup is confirmed for Saturday 12 Sep at 09:30. Fasting for 8 hours beforehand; bring the previous vaccination record.",
    receivedAt: "2026-09-08T08:02:00+08:00",
  },
  {
    id: "s3",
    source: "gmail",
    senderName: "Stripe",
    senderEmail: "receipts@stripe.com",
    subject: "Your August invoice is available",
    summaryText:
      "August invoice of USD 148.00 was charged to the card ending 4242. No action needed; no dates mentioned.",
    receivedAt: "2026-09-07T22:15:00+08:00",
  },
  {
    id: "s4",
    source: "outlook",
    senderName: "Acme People Ops",
    senderEmail: "people@acme.co",
    subject: "Q3 benefits enrolment closes 30 Sep",
    summaryText:
      "Benefits enrolment closes 30 Sep. Choose a dental tier and confirm dependants in the HR portal; unchanged selections roll over automatically.",
    receivedAt: "2026-09-07T17:30:00+08:00",
  },
];

/** Detected Events dismissed in earlier runs — the Ignored tab's starting contents. */
export const IGNORED_EVENTS: DetectedEvent[] = [
  {
    id: "i1",
    title: "Webinar: scaling Postgres",
    startsAt: "2026-09-09T21:00:00+08:00",
    endsAt: null,
    location: null,
    source: "gmail",
    sourceAccountEmail: "personal@gmail.com",
    senderName: "Marketing Weekly",
    senderEmail: "news@marketingweekly.com",
    subject: "Don't miss tonight's session",
    detectedAt: "2026-09-08T13:40:00+08:00",
    status: "ignored",
    targetCalendarId: "g-personal",
    error: null,
    ignoredAt: "2026-09-08T13:58:00+08:00",
  },
  {
    id: "i2",
    title: "Flash sale ends midnight",
    startsAt: "2026-09-08T23:59:00+08:00",
    endsAt: null,
    location: null,
    source: "gmail",
    sourceAccountEmail: "personal@gmail.com",
    senderName: "Shop Daily",
    senderEmail: "offers@shopdaily.com",
    subject: "Last chance — 40% off everything",
    detectedAt: "2026-09-08T13:40:00+08:00",
    status: "ignored",
    targetCalendarId: "g-personal",
    error: null,
    ignoredAt: "2026-09-08T13:52:00+08:00",
  },
  {
    id: "i3",
    title: "Quarterly newsletter",
    startsAt: "2026-09-15T10:00:00+08:00",
    endsAt: null,
    location: null,
    source: "outlook",
    sourceAccountEmail: "lin@outlook.com",
    senderName: "Acme Comms",
    senderEmail: "comms@acme.co",
    subject: "Your Q3 newsletter is here",
    detectedAt: "2026-09-08T13:40:00+08:00",
    status: "ignored",
    targetCalendarId: "o-lin",
    error: null,
    ignoredAt: "2026-09-08T13:45:00+08:00",
  },
];

/** The scheduled run this page is showing results from. */
export const LAST_SYNCED_AT = "2026-09-08T14:00:00+08:00";
export const NEXT_RUN_LABEL = "19:00";
