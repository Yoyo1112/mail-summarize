# Handoff: Mail → Calendar (Summary feed + Detected-event confirmation)

## Overview
A web UI for a scheduled job that reads a user's Gmail/Outlook mail, writes a Claude-generated
**Summary** per message, and extracts **Detected Events** (title / date-time / optional location).
The user reviews each detected event and either **confirms** it — which writes it to a chosen
connected calendar — or **ignores** it. The page has no live push: results appear after a manual
refresh or a background poll.

Hard product constraint (ADR-0002): **original email bodies are never stored**, only the summary
text. There is therefore no "view original" affordance anywhere in the UI, and the UI states this
explicitly once per summary section rather than per card.

## About the Design Files
`Mail to Calendar.dc.html` in this bundle is a **design reference created in HTML** — a prototype
that shows intended look and behaviour. It is not production code to copy. Recreate these screens in
the target codebase's existing environment (React/Next, Vue, SwiftUI, native…) using its established
component library, routing, and data layer. If no frontend exists yet, pick the framework that fits
the backend already described (a TS backend with `scripts/auth-gmail.ts` / `scripts/auth-outlook.ts`
suggests React + TypeScript) and implement there.

The file is a **design board**, not an app: it stacks six option cards side by side on one canvas.
Only option **1a** is interactive. Ship the screens, not the board chrome (`.dv-*` classes).

## Fidelity
**High-fidelity.** Colors, type, spacing and states are final-intent. Recreate pixel-closely, but
substitute the target codebase's existing primitives (Button, Select, Card, Banner) where they exist.

## Screens / Views

### 1a — Desktop triage stream (recommended primary layout, interactive in the prototype)
Purpose: one scroll — everything needing a decision on top, everything already summarised below.
Layout: app frame 1160px wide, background `#F6F4EF`, 1px border `rgba(20,19,15,.14)`, radius 4px.
- **Top bar** — height 58px, background `#FFFDF8`, bottom border `1px solid rgba(20,19,15,.13)`,
  padding 0 22px, flex space-between. Left: wordmark "Sift" (Instrument Serif 22px) + "mail → calendar"
  (JetBrains Mono 10px, 500, letter-spacing .14em, uppercase, `rgba(20,19,15,.62)`). Right: sync line
  ("Synced 2 min ago · next run 19:00", mono 11px) + Refresh button (height 32, padding 0 12,
  1px border `rgba(20,19,15,.18)`, radius 3, mono 11px uppercase; hover inverts to `#14130F`/`#F6F4EF`).
  While refreshing: glyph ↻ → ◌ and label "Checking for new results…" (900ms in the prototype).
- **Tab strip** — height 42px, same background/border. Tabs: "Needs review" (active, 2px bottom border
  `#14130F`, count pill `#A9690A` white mono 10px), "Summaries 24", "Ignored 3".
- **Body** — padding 26px 22px 34px.
  - Section header row: label "DETECTED EVENTS · NEEDS REVIEW" (mono 10px uppercase, ls .14em) +
    right-side note "Nothing is written to a calendar until you confirm it." (12px, `rgba(20,19,15,.65)`).
  - Event cards, 14px gap (see **Detected event card** below).
  - Divider (22px padding-top, 1px `rgba(20,19,15,.13)`), then "RECENT SUMMARIES" + the privacy note
    "⌾ Summary text only — original messages are never stored (ADR-0002)".
  - Summary table: single bordered container, rows `grid-template-columns: 20px 190px 1fr 88px`,
    gap 14px, padding 15px 18px, row divider `1px solid rgba(20,19,15,.09)`.

### 1b — Desktop split view
Two columns `1fr 400px`. Left: summary cards (16px padding, radius 4) as a scanning column, each with
an amber "1 EVENT DETECTED →" pill when it produced an event. Right rail (background `rgba(20,19,15,.035)`):
condensed pending cards with a 3px `#A9690A` left bar, a When/Where/From label grid (52px label column),
compact calendar select, and a `1fr auto` button pair. Confirmed items sit below at opacity .72 with a
green left bar. Use this when users mostly read summaries and triage occasionally.

### 1c / 1d — Mobile (390px)
1c: status bar, 58px header with a 30px refresh square, "NEEDS REVIEW 2", one expanded pending card,
one collapsed pending card, then summaries. All tap targets **≥48px** (buttons are 48px tall, stacked
with 8px gap, full width).
1d: calendar bottom sheet (drag handle 38×4, rows 56px, selected row `rgba(30,91,60,.08)` + border
`rgba(30,91,60,.28)` + "✓"; lists all five connected calendars), the **confirmed** card (green left bar,
"Added to Google · work@acme.co — Thu 10 Sep, 14:00–15:00", Open in calendar / Undo) and the
**write-failed** card (red left bar, "Could not write · token expired", raw diagnostic line
"401 invalid_grant · 14:03:22", Reconnect Google / Retry, and the reassurance that nothing was added).

### 1e — Card anatomy
Ignored card (3px `rgba(20,19,15,.25)` bar, container `opacity:.55–.6`, title struck through, Restore
button) and the **edit-before-write** variant: editable title (serif input), Date and Time inputs
(mono 13px, 36px tall), Location input rendered with a **dashed** border when detection found none,
provenance strip on `rgba(20,19,15,.04)`, then calendar select + Cancel / "Save and add".

### 1f — Empty, first-run and failure states
1. **First run** — "No summaries yet", explains the 14:00 first run and that the page does not push
   updates live; "Run now" button.
2. **Queue empty** — green-tinted panel: "Nothing to review · 24 summaries from the 14:00 run".
3. **Missing calendar scope (Phase 2)** — amber panel "Re-authorisation required", lists each account
   with its current scope (`gmail.readonly`, `Mail.Read`), CTA "Grant calendar access" / "Later".
   Blocks every write; show above the queue and disable confirm buttons.
4. **Quota exhausted** — red banner, "Calendar API quota reached for today", how many events stayed
   pending, reset time, diagnostic `429 rateLimitExceeded`, "Retry all".
5. **Freshness strip** — "Showing results from the 14:00 run · next run 19:00 · auto-checks every 5 min"
   with a Refresh button. Because there is no push, always state the age of the data.

## Detected event card (the core component)
Grid `3px 1fr`; the 3px bar carries status colour. Body padding 18px 20px 16px, background `#FFFDF8`,
border `1px solid rgba(20,19,15,.16)`, radius 4.
1. **Header row**: status chip (padding 4px 8px, radius 3, mono 9.5px uppercase ls .12em) + "detected 14:00"
   (mono 11px). Right: WHEN block, right-aligned — label (mono 10px uppercase) / date (Public Sans 600 14px)
   / time (mono 12.5px).
2. **Title**: Instrument Serif 26px/1.2, `text-wrap:pretty`.
3. **Two-column detail grid** (`1fr 1fr`, divider between, 13px vertical padding):
   - **WHERE** — location text 13.5px; when null, an em-dash rule + italic 13px
     "No location in the email — event will be created without one" (`rgba(20,19,15,.64)`).
     Never hide the field; the absence is information.
   - **DETECTED FROM** — 18px source tile (G = `rgba(217,48,37,.12)`/`#B4271C`, O = `rgba(30,92,158,.12)`/`#1B5590`),
     sender (600 12.5px), subject (12px, ellipsised). This is the provenance the user judges by, and it
     is all that can be shown — the body no longer exists.
4. **Action row** (pending only): target-calendar select on the left (38px tall, min-width 320px, 8px
   provider dot, label "Google · work@acme.co", right-side hint "same source" / "cross-provider"), and
   on the right "Not an event" (ghost; hover turns `#A32B1C`) + "Add to calendar" (filled `#14130F`,
   hover `#1E5B3C`).
5. **Resolved row** (confirmed or ignored): result sentence + Undo (32px ghost button).

Dropdown: absolutely positioned, 360px wide, `top:66px`, background `#FFFDF8`, shadow
`0 12px 28px rgba(20,19,15,.16)`, header "CONNECTED CALENDARS · 5", rows 9px padding with provider dot,
label, sub-label (mono 11px) and "✓" on the selected one.

## Interactions & Behavior
- **Default target calendar** = the calendar of the same provider/account the email arrived on
  (Gmail → that Google account). User may switch to any connected calendar; when the choice crosses
  providers the hint reads "cross-provider".
- **Add to calendar** → POST confirm; on success the card collapses to the confirmed state with the
  written target and time, plus **Undo** (should delete the created event and return the row to pending).
- **Not an event / Ignore** → status `ignored`; the row leaves the Needs-review count and the queue,
  and is reachable under the Ignored tab with **Restore**. This is required — misdetections otherwise
  flood the queue forever. Ignoring is per-event only; sender-level muting is explicitly out of scope.
- **Optimistic update with rollback**: flip to confirmed immediately, and on API failure roll back to
  pending and attach the failure banner to that card (never silently drop it).
- **Empty queue** → dashed "Review queue is clear" panel naming the next run time.
- **Refresh** → manual button plus a 5-minute background poll; always render "synced N min ago".
- Hover states: buttons darken/invert as noted; dropdown rows `rgba(20,19,15,.05)`.
- Responsive: ≥1100px two-column details; below ~760px collapse to the 1c mobile stack.

## State Management
Client: `events[]` (id, title, startsAt, endsAt, location|null, source, senderName, senderEmail,
subject, detectedAt, status, targetCalendarId, error|null), `summaries[]`, `calendars[]`,
`lastSyncedAt`, `nextRunAt`, `refreshing`, `openDropdownId`, `scopeMissing`.
Transitions: pending → confirmed (confirm success) / ignored (ignore) / pending+error (confirm failure);
confirmed → pending (undo); ignored → pending (restore).

Backend endpoints the UI assumes:
- `GET /summaries?limit&cursor` → summary list (source, sender, subject, summaryText, receivedAt)
- `GET /events?status=pending|confirmed|ignored`
- `POST /events/:id/confirm { calendarId }` → writes to the calendar, returns provider event id or a
  typed error (`token_expired` | `quota_exceeded` | `missing_scope` | `network`)
- `POST /events/:id/ignore`, `POST /events/:id/restore`, `DELETE /events/:id/confirm` (undo)
- `GET /calendars` → connected calendars for the picker (id, provider, displayName, accountEmail)
Persistence: a table for summaries and one for detected events with status; the scheduled job writes,
the API reads. Store no raw message bodies.

OAuth (Phase 2): current scopes are `gmail.readonly` and `Mail.Read`. Add
`https://www.googleapis.com/auth/calendar.events` and `Calendars.ReadWrite`, then re-run
`scripts/auth-gmail.ts` and `scripts/auth-outlook.ts` to re-consent. Until a token carries the write
scope, render state 3 in 1f and disable confirm.

## Design Tokens
Colors — ink `#14130F`; paper `#F6F4EF`; card `#FFFDF8`; board background `#EDEAE3`;
rules `rgba(20,19,15,.09 / .13 / .16 / .2)`; secondary text `rgba(20,19,15,.62–.72)` (all body/metadata
text stays at ≥.62 alpha for 4.5:1 contrast); pending amber `#A9690A` (text `#8A5407`, tint `rgba(169,105,10,.13)`);
confirmed green `#1E5B3C` (tint `rgba(30,91,60,.08)`); error red `#A32B1C` (tint `rgba(163,43,28,.05)`);
Gmail mark `#B4271C` on `rgba(217,48,37,.12)`; Outlook mark `#1B5590` on `rgba(30,92,158,.12)`.
Type — Instrument Serif (titles 26 / 21 / 20 / 19px), Public Sans (body 13.5/1.55, labels 12.5–14px,
weights 400/500/600), JetBrains Mono (metadata 9.5–13px, uppercase labels ls .12–.14em).
Spacing — 4 / 6 / 9 / 12 / 14 / 18 / 22 / 26 / 34px. Radius — 3px controls, 4px cards, 26px phone.
Shadow — cards `0 1px 2px rgba(20,19,15,.06)`; dropdown `0 12px 28px rgba(20,19,15,.16)`.
Controls — desktop buttons/inputs 32–38px tall; mobile 48px; dropdown rows 56px on mobile.

## Assets
No external images. Provider marks are **placeholder** letter tiles ("G" / "O") — replace with the
official Gmail/Outlook marks from the target codebase's asset set (do not redraw them). Fonts load from
Google Fonts; swap for the codebase's self-hosted equivalents if it has them.

## Files
- `Mail to Calendar.dc.html` — the design board (options 1a–1f). Open in a browser; option 1a is
  interactive (calendar picker, confirm, ignore, undo, refresh).
- `support.js` — runtime required by the HTML file; keep it next to it.
- `screenshots/` — 2x renders of each option, matching the section names above:
  - `1a-desktop-triage-stream.png`
  - `1b-desktop-split-view.png`
  - `1c-mobile-queue.png`
  - `1d-mobile-sheet-and-results.png`
  - `1e-card-anatomy.png`
  - `1f-empty-and-error-states.png`
