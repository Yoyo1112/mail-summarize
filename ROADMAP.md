# Roadmap

Delivery is staged in three phases so the riskiest, hardest-to-validate part — whether Triage actually surfaces the right emails — gets tested before any surrounding infrastructure (auth, multi-User, hosting) is built around it. See [CONTEXT.md](./CONTEXT.md) for the terms used below (User, Mail Account, Triage, Digest, Detected Event, Confirmation, Target Calendar).

## Phase 1 — Validate Triage and summarization quality

No login, no web UI, single User (the operator only). Both a Gmail Mail Account and an Outlook Mail Account are connected from the start — the two providers are validated together, not sequentially, since the product's premise is summarizing both.

**Pipeline**: on a schedule, fetch new mail from both Mail Accounts → Triage (rule-based coarse filter, then LLM importance judgment) → Summary generation → merge Summaries from both accounts into one Digest → email the Digest to the operator.

**Explicitly out of scope**: Detected Events / calendar writing, any web page, any account system, more than one User.

**Done when**: the operator has run this across real mail for long enough to judge whether Triage's importance calls and Summary quality are good enough to build on. This phase can loop (tune rules/prompts, re-run) before moving on — it isn't a fixed-duration milestone.

## Phase 2 — Add calendar event detection and confirmation

Adds Detected Event extraction to Triage, and the minimum web UI needed to review and confirm them.

**New pipeline step**: emails that pass Triage are also checked for a Detected Event (title, time, location extracted). Detected Events are held pending, never auto-written.

**New surface**: a simple, unauthenticated (still single-User) web page showing Summary cards and pending Detected Events, each with a Confirmation control. Confirming writes the event to its Target Calendar (default: same-provider calendar, per [CONTEXT.md](./CONTEXT.md)).

**Digest email** now also links to this page instead of (or alongside) inlining Summaries, per [ADR-0003](./docs/adr/0003-no-actionable-links-in-digest-emails.md) — the email never carries a link that itself confirms an event.

**Done when**: the operator can rely on the confirm-to-calendar flow for their own two Mail Accounts without surprises (wrong Target Calendar, missed events, false positives).

## Phase 3 — Multi-User and production deployment

**Identity**: real login (Google/Microsoft OAuth doubling as authentication, per [ADR-0001](./docs/adr/0001-full-application-with-authentication.md)). Each person is a User who can connect their own Mail Accounts (1:N, any mix of Gmail/Outlook).

**Data**: per-User isolation for Summaries and Detected Events; raw email content still never persisted ([ADR-0002](./docs/adr/0002-no-raw-email-content-persisted.md)).

**Onboarding for Google**: the app stays in Google OAuth's Testing publishing status initially (refresh tokens expire after 7 days; a failed Digest run notifies the affected User to re-authorize). Each friend/family member's Gmail address must be manually added to the Google Cloud Console test-user allowlist before they can authorize — this is a manual step the operator does per person, not self-serve. Upgrading to Production status (for long-lived tokens, no manual allowlisting) is a later, independent decision — same OAuth client, no rebuild required.

**Settings**: per-User Digest frequency (configurable, 30-minute minimum) and language (auto-detected from browser/mail content, manually overridable).

**Deployment**: managed cloud PaaS ([ADR-0004](./docs/adr/0004-managed-cloud-paas-deployment.md)) — the app needs to be reachable by friends/family independent of the operator's own machine being on.

**Done when**: at least one person other than the operator has connected a Mail Account, received a Digest, and confirmed a Detected Event end-to-end.
