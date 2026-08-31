import { config } from "./config.js";
import { fetchRecentGmail } from "./mail/gmail.js";
import { fetchRecentOutlook } from "./mail/outlook.js";
import { triage } from "./triage/run.js";
import { composeDigest } from "./digest/compose.js";
import { sendDigest } from "./digest/send.js";

async function main() {
  console.log(`Fetching mail from the last ${config.lookbackHours}h...`);
  const [gmail, outlook] = await Promise.all([
    fetchRecentGmail(config.lookbackHours),
    fetchRecentOutlook(config.lookbackHours),
  ]);

  const emails = [...gmail, ...outlook];
  console.log(`Fetched ${gmail.length} Gmail + ${outlook.length} Outlook = ${emails.length} emails.`);

  const triaged = await triage(emails);
  console.log(`Triage kept ${triaged.length} of ${emails.length} as important.`);

  const { subject, html, text } = composeDigest(triaged);
  await sendDigest(subject, html, text);
  console.log(`Digest sent to ${config.resend.toEmail}.`);
}

main().catch((error) => {
  console.error("Digest run failed:", error);
  process.exitCode = 1;
});
