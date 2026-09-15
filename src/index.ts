import { config } from "./config.js";
import { fetchRecentGmail, getGmailAccountEmail } from "./mail/gmail.js";
import { fetchRecentOutlook, getOutlookAccountEmail } from "./mail/outlook.js";
import { contentFingerprint, dropDuplicates } from "./mail/dedupe.js";
import { parseSender } from "./mail/sender.js";
import type { MailProvider } from "./mail/types.js";
import { triage } from "./triage/run.js";
import { detectEvents } from "./detect/events.js";
import { composeDigest } from "./digest/compose.js";
import { sendDigest } from "./digest/send.js";
import {
  LAST_RUN_AT,
  filterUnprocessed,
  findFingerprintOwners,
  markProcessed,
  recordFingerprints,
  saveDetectedEvent,
  saveSummary,
  setMeta,
} from "./store/repository.js";
import { closeDb } from "./store/db.js";

async function main() {
  console.log(`Fetching mail from the last ${config.lookbackHours}h...`);
  const [gmail, outlook] = await Promise.all([
    fetchRecentGmail(config.lookbackHours),
    fetchRecentOutlook(config.lookbackHours),
  ]);

  const fetched = [...gmail, ...outlook];
  console.log(`Fetched ${gmail.length} Gmail + ${outlook.length} Outlook = ${fetched.length} emails.`);

  // Drop copies of mail already seen under another message id, before anything is spent
  // on them — so a resent notice is neither summarised nor in the digest twice.
  const { unique: emails, duplicates, newFingerprints } = dropDuplicates(
    fetched,
    findFingerprintOwners(fetched.map(contentFingerprint)),
  );
  recordFingerprints(newFingerprints);
  if (duplicates.length > 0) {
    console.log(`Skipped ${duplicates.length} duplicate email${duplicates.length === 1 ? "" : "s"} (same sender, subject and body).`);
  }

  const triaged = await triage(emails);
  console.log(`Triage kept ${triaged.length} of ${emails.length} as important.`);

  // Persist Summaries so the web app can read them. Only derived text — see ADR-0002.
  let storedSummaries = 0;
  for (const { email, summary } of triaged) {
    const sender = parseSender(email);
    const wrote = saveSummary({
      provider: email.provider,
      messageId: email.id,
      senderName: sender.name,
      senderEmail: sender.email,
      subject: email.subject,
      summaryText: summary,
      receivedAt: email.receivedAt,
    });
    if (wrote) storedSummaries += 1;
  }
  console.log(`Stored ${storedSummaries} new summaries (${triaged.length - storedSummaries} already known).`);

  await detectAndStoreEvents(triaged);

  // The Digest email still carries the Summaries from this run, unchanged.
  const { subject, html, text } = composeDigest(triaged);
  await sendDigest(subject, html, text);
  console.log(`Digest sent to ${config.resend.toEmail}.`);

  setMeta(LAST_RUN_AT, new Date().toISOString());
}

/**
 * Extracts Detected Events from the emails that passed Triage and stores them Pending.
 * Nothing is written to a calendar here — that needs a Confirmation (ADR-0003).
 */
async function detectAndStoreEvents(triaged: Awaited<ReturnType<typeof triage>>) {
  if (!config.detectEvents) {
    console.log("Event detection: disabled (DETECT_EVENTS=false).");
    return;
  }

  // Skip anything an earlier run already examined, so overlapping lookback windows
  // do not produce the same event twice.
  const fresh = triaged.filter((item) => {
    const unprocessed = filterUnprocessed(item.email.provider, [item.email.id]);
    return unprocessed.length > 0;
  });

  if (fresh.length === 0) {
    console.log("Event detection: nothing new to examine.");
    return;
  }

  const accountEmails = await resolveAccountEmails(fresh);
  const detections = await detectEvents(fresh);

  let stored = 0;
  for (const { email, events } of detections) {
    const sender = parseSender(email);
    for (const event of events) {
      saveDetectedEvent({
        provider: email.provider,
        messageId: email.id,
        sourceAccountEmail: accountEmails[email.provider],
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        senderName: sender.name,
        senderEmail: sender.email,
        subject: email.subject,
      });
      stored += 1;
    }
  }

  // Mark examined only after storing, so a crash mid-run re-examines rather than
  // silently dropping the events it had not written yet.
  for (const provider of ["gmail", "outlook"] as const) {
    const ids = fresh.filter((item) => item.email.provider === provider).map((item) => item.email.id);
    markProcessed(provider, ids);
  }

  console.log(
    `Event detection: examined ${fresh.length} emails, stored ${stored} pending detected event${stored === 1 ? "" : "s"}.`,
  );
}

/** Looks up each Mail Account address once, and only for providers actually present. */
async function resolveAccountEmails(
  items: Awaited<ReturnType<typeof triage>>,
): Promise<Record<MailProvider, string>> {
  const providers = new Set(items.map((item) => item.email.provider));
  const [gmailAccount, outlookAccount] = await Promise.all([
    providers.has("gmail") ? getGmailAccountEmail() : Promise.resolve(""),
    providers.has("outlook") ? getOutlookAccountEmail() : Promise.resolve(""),
  ]);
  return { gmail: gmailAccount, outlook: outlookAccount };
}

main()
  .catch((error) => {
    console.error("Digest run failed:", error);
    process.exitCode = 1;
  })
  .finally(closeDb);
