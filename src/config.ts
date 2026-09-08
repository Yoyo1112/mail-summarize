import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    refreshToken: required("GOOGLE_REFRESH_TOKEN"),
    /** Optional — looked up from the Gmail profile when unset. */
    accountEmail: process.env.GMAIL_ACCOUNT_EMAIL ?? "",
  },

  microsoft: {
    clientId: required("MICROSOFT_CLIENT_ID"),
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "consumers",
    refreshToken: required("MICROSOFT_REFRESH_TOKEN"),
    /** Optional — reading it from Graph needs a scope the current token lacks. */
    accountEmail: process.env.OUTLOOK_ACCOUNT_EMAIL ?? "",
  },

  resend: {
    apiKey: required("RESEND_API_KEY"),
    fromEmail: required("DIGEST_FROM_EMAIL"),
    toEmail: required("DIGEST_TO_EMAIL"),
  },

  lookbackHours: Number(process.env.LOOKBACK_HOURS ?? "6"),

  /** Where Phase 2 keeps Summaries and Detected Events (ADR-0005). Local state, git-ignored. */
  databasePath: process.env.DATABASE_PATH ?? "data/mail-digest.db",

  /**
   * Whether to extract and store Detected Events. Turn this off where the database
   * does not survive the run — the scheduled GitHub Actions job has an ephemeral
   * filesystem, so detecting there would cost an LLM call per run and discard it.
   */
  detectEvents: (process.env.DETECT_EVENTS ?? "true") !== "false",

  /** The timezone relative dates in emails are resolved against. */
  timezone: process.env.TIMEZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
};
