import { config } from "../config.js";

/**
 * The scopes the connected tokens currently hold. Writing a confirmed event needs
 * `https://www.googleapis.com/auth/calendar.events` and `Calendars.ReadWrite`, which
 * neither token carries — so no calendar can be listed and no Confirmation can be
 * written until the auth scripts are re-run with the wider scopes.
 */
const CURRENT_SCOPES = {
  gmail: "gmail.readonly",
  outlook: "Mail.Read",
} as const;

export interface ConnectedAccount {
  provider: "gmail" | "outlook";
  accountEmail: string;
  currentScope: string;
  /** The scope a Confirmation would need. */
  requiredScope: string;
}

export interface CalendarAccess {
  /** Empty until calendar scopes are granted — there is nothing to list without them. */
  calendars: never[];
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
}

/**
 * What the UI needs to render the "Re-authorisation required" state (option 1f) and
 * to keep the confirm controls disabled while writes cannot succeed.
 */
export function calendarAccess(): CalendarAccess {
  const accounts: ConnectedAccount[] = [
    {
      provider: "gmail",
      accountEmail: config.google.accountEmail,
      currentScope: CURRENT_SCOPES.gmail,
      requiredScope: "https://www.googleapis.com/auth/calendar.events",
    },
    {
      provider: "outlook",
      accountEmail: config.microsoft.accountEmail,
      currentScope: CURRENT_SCOPES.outlook,
      requiredScope: "Calendars.ReadWrite",
    },
  ];

  return { calendars: [], scopeMissing: true, accounts };
}
