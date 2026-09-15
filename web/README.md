# Web UI (Phase 2)

The review surface from [ROADMAP.md](../ROADMAP.md) Phase 2: Summary cards and pending
Detected Events, each with a Confirmation control. Built from
[`design_handoff_mail_to_calendar/`](../design_handoff_mail_to_calendar/).

React + TypeScript + Vite, per the handoff's guidance for a codebase whose backend is
already TypeScript (`README.md` § About the Design Files).

```bash
# terminal 1 — the API, from the repository root
npm run serve      # http://localhost:3000

# terminal 2 — the client
cd web
npm install
npm run dev        # http://localhost:5173, proxies /api to the server above
npm run build      # typecheck + production build
```

After `npm run build`, the API server also serves the built client, so
http://localhost:3000 alone is enough — the Vite dev server is only for development.

Data comes from the real API (`src/api/server.ts`), reading the SQLite database the
pipeline writes ([ADR-0005](../docs/adr/0005-sqlite-for-phase-2-persistence.md)). Run
`npm run digest` first, or the page shows its first-run state.

## What is implemented

- **Option 1a — desktop triage stream**: top bar with the sync/freshness line and
  Refresh, tab strip, pending queue, and the recent-summaries table.
- **The detected-event card** (`src/components/DetectedEventCard.tsx`), the core
  component: all three statuses (pending / confirmed / ignored), the WHEN block, the
  two-column WHERE + DETECTED FROM grid including the explicit "no location" state,
  the Target Calendar picker, and the resolved row with Undo / Restore.
- **Interactions**: calendar selection with the "same source" / "cross-provider" hint,
  Confirmation, Dismissal, Undo/Restore, and Refresh.
- **Option 1c — mobile queue** (`src/screens/MobileQueue.tsx`), below 760px: the
  narrow header, the pending queue with one card expanded and the rest collapsed to a
  tap-to-review row, and summaries as stacked cards. Tap targets are 48px.
- **Option 1d — mobile flows**: the calendar bottom sheet (`CalendarSheet.tsx`), the
  written-successfully card, and the write-failed card with its diagnostic line and
  Reconnect / Retry actions.
- **Optimistic Confirmation with rollback**: confirming flips the card immediately and,
  if the API rejects the write, returns it to pending with the failure attached to that
  card rather than silently dropped.
- **Option 1f state 3 — missing calendar scope** (`ScopeBanner.tsx`), which is the
  honest state today: the connected tokens hold read-only mail scopes, so every
  Confirmation would fail. The banner sits above the queue and the confirm buttons are
  disabled while it shows.
- **First-run and API-unreachable states** in `App.tsx`.

Screens render at the design's tokens (`src/styles/tokens.css`) — colours, type scale,
spacing and radii are taken from the handoff's token section rather than eyeballed.

### What works against real data now

Dismissal ("Not an event") and Restore write to the database and survive a reload — so
false detections can be triaged away today, which is exactly what is needed while
judging detection quality.

Confirmation cannot work yet: the API returns `missing_scope` rather than pretending
to succeed, and the UI leaves the event Pending. Nothing is ever shown as added to a
calendar unless it was.

## Not implemented yet

Deliberately out of scope so far, listed so it is clear what is missing rather than
overlooked:

- **Options 1b and 1e**: the desktop split view and the edit-before-write variant.
- **1f's other states**: quota-exhausted, and the "Run now" button on first run.
- **Calendar writes.** The current tokens are read-only (`gmail.readonly`, `Mail.Read`).
  Until `calendar.events` and `Calendars.ReadWrite` are added and the auth scripts are
  re-run, `POST /events/:id/confirm` returns `missing_scope` and no calendar can be
  listed — so the Target Calendar picker has nothing to show and stays hidden.
- **Pagination.** `GET /summaries` takes a `limit` but no cursor yet.

## Deviations from the handoff

- Provider marks are the handoff's placeholder "G" / "O" letter tiles. The handoff says
  to replace them with official Gmail/Outlook marks from an asset set; this codebase has
  none yet.
- The calendar dropdown's sub-label is derived from the documented `accountEmail` field
  ("Google Calendar", or "Google Calendar · work@acme.co" for a shared calendar) rather
  than the prototype's hand-written qualifiers ("· work", "· shared"), which are not part
  of the specified API shape.
- Month abbreviations are pinned in `src/lib/format.ts`: recent ICU renders September as
  "Sept" in en-GB, and the design calls for "Sep".
- Times render in the viewer's timezone. The design's screenshots are GMT+8.
- The mobile mock's phone status bar ("9:41", signal bars) and the 26px device corner
  radius are design-board chrome, not app UI, so they are not reproduced.
- `DetectedEvent` carries a `sourceAccountEmail` — the Mail Account the email arrived
  on. The sheet's "same source as email" hint is per-account, and a User can connect
  several accounts of one provider (CONTEXT.md), so the provider alone cannot identify
  it. The desktop picker's hint stays provider-level ("same source" / "cross-provider")
  as the handoff specifies.
- "Open in calendar" on the confirmed mobile card is disabled until the API returns the
  provider's event link.
- The design's "Grant calendar access" button assumes a browser OAuth flow. Re-consent
  happens from the command line in this phase, so the banner names the commands instead
  of offering a button that cannot do anything.
- The top bar shows "Synced N min ago" without the design's "next run HH:MM": nothing
  schedules the pipeline yet, so there is no next run time to state.
- The mobile summaries section is headed "today" only when it has today's Summaries;
  otherwise it says "recent", rather than showing older items under a "today" heading.
