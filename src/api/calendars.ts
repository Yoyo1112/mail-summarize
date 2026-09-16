import { config } from "../config.js";
import {
  GOOGLE_CALENDAR_LIST_SCOPE,
  GOOGLE_CALENDAR_WRITE_SCOPE,
  GOOGLE_PRIMARY_CALENDAR_ID,
  hasGoogleCalendarAccess,
  listGoogleCalendars,
} from "../calendar/google.js";
import type { Calendar } from "../calendar/types.js";
import { describeError } from "../errors.js";
import { googleScopes } from "../google-auth.js";
import { getGmailAccountEmail } from "../mail/gmail.js";
import type { MailProvider } from "../mail/types.js";

export interface ConnectedAccount {
  provider: MailProvider;
  accountEmail: string;
  currentScope: string;
  /** The scope a Confirmation would need. */
  requiredScope: string;
}

export interface CalendarAccess {
  calendars: Calendar[];
  /** True when no connected account can write to a calendar, so every Confirmation would fail. */
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
}

/** Scope URLs shortened to what the UI shows, e.g. "gmail.readonly". */
function shortScope(scope: string): string {
  return scope.replace("https://www.googleapis.com/auth/", "");
}

/**
 * What the UI needs to render the calendar picker, the "Re-authorisation required" state
 * (option 1f) and whether confirm controls are enabled — read from the tokens' actual
 * scopes, so re-running an auth script is all it takes to enable writing.
 *
 * Outlook calendars are not written to yet: its token holds Mail.Read only, and there is
 * no Outlook mail to confirm events from. It is listed so the banner says so.
 */
export async function calendarAccess(): Promise<CalendarAccess> {
  let googleScopeList: string[] = [];
  let googleWritable = false;
  let calendars: Calendar[] = [];

  let gmailAccountEmail = config.google.accountEmail;

  try {
    gmailAccountEmail ||= await getGmailAccountEmail();
    googleScopeList = await googleScopes();
    googleWritable = await hasGoogleCalendarAccess();
    if (googleWritable) calendars = await listGoogleCalendars();
  } catch (error) {
    // Calendars unavailable is shown as an empty picker; a confirm then reports the reason.
    console.warn(`Could not read Google calendar access: ${describeError(error)}`);
  }

  const accounts: ConnectedAccount[] = [
    {
      provider: "gmail",
      accountEmail: gmailAccountEmail,
      currentScope: googleScopeList.map(shortScope).join(", ") || "unknown",
      requiredScope: [GOOGLE_CALENDAR_WRITE_SCOPE, GOOGLE_CALENDAR_LIST_SCOPE].map(shortScope).join(", "),
    },
    {
      provider: "outlook",
      accountEmail: config.microsoft.accountEmail,
      currentScope: "Mail.Read",
      requiredScope: "Calendars.ReadWrite",
    },
  ];

  return { calendars, scopeMissing: !googleWritable, accounts };
}

/**
 * The default Target Calendar for a Detected Event: the calendar of the provider its
 * email arrived on (CONTEXT.md). Null when that provider has no writable calendar.
 */
export function defaultCalendarId(provider: MailProvider): string | null {
  return provider === "gmail" ? GOOGLE_PRIMARY_CALENDAR_ID : null;
}
