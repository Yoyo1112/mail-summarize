# Web UI (Phase 2)

The review surface from [ROADMAP.md](../ROADMAP.md) Phase 2: Summary cards and pending
Detected Events, each with a Confirmation control. Built from
[`design_handoff_mail_to_calendar/`](../design_handoff_mail_to_calendar/).

React + TypeScript + Vite, per the handoff's guidance for a codebase whose backend is
already TypeScript (`README.md` § About the Design Files).

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

This package is self-contained. It does not import from `../src`, and running it does
not affect `npm run digest` — the Phase 1 pipeline is untouched.

## What is implemented

- **Option 1a — desktop triage stream**: top bar with the sync/freshness line and
  Refresh, tab strip, pending queue, and the recent-summaries table.
- **The detected-event card** (`src/components/DetectedEventCard.tsx`), the core
  component: all three statuses (pending / confirmed / ignored), the WHEN block, the
  two-column WHERE + DETECTED FROM grid including the explicit "no location" state,
  the Target Calendar picker, and the resolved row with Undo / Restore.
- **Interactions**: calendar selection with the "same source" / "cross-provider" hint,
  Confirmation, Dismissal, Undo/Restore, and Refresh.

Screens render at the design's tokens (`src/styles/tokens.css`) — colours, type scale,
spacing and radii are taken from the handoff's token section rather than eyeballed.

## Not implemented yet

Deliberately out of this first pass, listed so it is clear what is missing rather than
overlooked:

- **Options 1b–1f**: split view, both mobile layouts, the edit-before-write variant,
  and the empty/first-run/error panels. The card's failure banner exists in the
  component but no code path reaches it until the API does.
- **The backend.** There is none. The pipeline in `../src` is a one-shot batch job that
  emails a Digest and exits — no database, no server, no `DetectedEvent` extraction, no
  calendar writes. `src/fixtures.ts` stands in for the API and is shaped to match the
  endpoints the handoff specifies (`GET /events`, `GET /summaries`, `GET /calendars`,
  `POST /events/:id/confirm`, …). Swapping fixtures for real fetches is a one-file change.
- **OAuth calendar scopes.** Current scopes are read-only (`gmail.readonly`, `Mail.Read`).
  Confirmation cannot write to a calendar until `calendar.events` and `Calendars.ReadWrite`
  are added and the auth scripts are re-run.

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
