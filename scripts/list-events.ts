/**
 * Prints what detection has found, so the operator can judge its quality without a
 * browser or a calendar write. This is the Phase 2 equivalent of reading the Digest:
 * the question it answers is "are these actually events I would want on my calendar?".
 *
 *   npm run events            # pending
 *   npm run events -- ignored # or confirmed
 */
import { config } from "../src/config.js";
import { closeDb } from "../src/store/db.js";
import { countSummaries, listEventsByStatus } from "../src/store/repository.js";
import type { DetectedEventStatus } from "../src/store/types.js";

const VALID: DetectedEventStatus[] = ["pending", "confirmed", "ignored"];

function formatWhen(startsAt: string, endsAt: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: config.timezone,
  };
  const start = new Intl.DateTimeFormat("en-GB", options).format(new Date(startsAt));
  if (!endsAt) return start;

  const end = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: config.timezone,
  }).format(new Date(endsAt));
  return `${start}–${end}`;
}

function main() {
  const requested = (process.argv[2] ?? "pending") as DetectedEventStatus;
  if (!VALID.includes(requested)) {
    console.error(`Unknown status "${requested}". Use one of: ${VALID.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const events = listEventsByStatus(requested);
  console.log(`Database: ${config.databasePath}`);
  console.log(`Summaries stored: ${countSummaries()}`);
  console.log(`Detected events (${requested}): ${events.length}\n`);

  if (events.length === 0) {
    console.log("Nothing to show. Run `npm run digest` first.");
    return;
  }

  for (const event of events) {
    console.log(`  ${event.title}`);
    console.log(`    when      ${formatWhen(event.startsAt, event.endsAt)}`);
    console.log(`    where     ${event.location ?? "— none in the email"}`);
    console.log(`    from      ${event.senderName} <${event.senderEmail}> · ${event.provider}`);
    console.log(`    subject   ${event.subject}`);
    console.log(`    account   ${event.sourceAccountEmail || "— unknown"}`);
    console.log("");
  }
}

try {
  main();
} finally {
  closeDb();
}
