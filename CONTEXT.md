# Mail Digest

Automatically triages Gmail and Outlook mail, summarizes what matters, delivers it to the user on a schedule, and — once the user confirms — writes detected time-sensitive items to their calendar.

## Language

### Identity & Connections

**User**:
A person with an account in the app. Owns one or more Mail Accounts and receives Digests.
_Avoid_: Account, Member.

**Mail Account**:
A single Gmail or Outlook mailbox a User has connected for reading. A User may connect several, of either provider, in any combination.
_Avoid_: Inbox, Mailbox, Account.

### Digest Pipeline

**Triage**:
The two-stage process that decides whether an email is worth surfacing: a rule-based coarse filter (e.g. known promotional/notification senders, already-read mail) followed by an LLM judgment of importance on what survives.
_Avoid_: Filtering, Screening.

**Summary**:
The condensed, human-readable description of one email that passed Triage.
_Avoid_: Report, Recap.

**Digest**:
The bundle of Summaries (and any pending Detected Events) produced for a User in one delivery cycle, on their configured schedule.
_Avoid_: Report, Notification (the Digest is the content; the email that announces it is the notification).

**Detected Event**:
A calendar event — title, time, location — extracted from an email during Triage. Held in a pending state until the User confirms it; never written to a calendar automatically.
_Avoid_: Appointment, Reminder, Calendar item.

**Confirmation**:
The User's act, taken in the web app, of approving a Detected Event so it gets written to a Target Calendar. Confirmation never happens by clicking a link inside a Digest email — see [ADR-0003](./docs/adr/0003-no-actionable-links-in-digest-emails.md).
_Avoid_: Approval, Acceptance.

**Target Calendar**:
The calendar a confirmed Detected Event is written to. Defaults to the calendar belonging to the same provider as the Detected Event's source Mail Account (Gmail → Google Calendar, Outlook → Outlook Calendar), but the User can override it at confirmation time to any calendar reachable through their other Mail Accounts.
_Avoid_: Calendar (ambiguous on its own — always qualify as Target Calendar when referring to a write destination).
