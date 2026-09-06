import { composeDigest } from "../src/digest/compose.js";
import { sendDigest } from "../src/digest/send.js";
import type { TriagedEmail } from "../src/triage/run.js";

/**
 * Sends a digest built from fake data — for checking the Resend delivery
 * path (compose + send) without spending any Claude API credit. Not part
 * of the real pipeline; run with `npm run test:send`.
 */

const fakeItems: TriagedEmail[] = [
  {
    email: {
      provider: "gmail",
      id: "fake-1",
      from: "professor@example.edu",
      subject: "Reminder: assignment due Friday",
      receivedAt: new Date().toISOString(),
      snippet: "",
    },
    summary: "This is a test summary — if you're reading this in your inbox, the Resend delivery path works.",
  },
];

const { subject, html, text } = composeDigest(fakeItems);
await sendDigest(subject, html, text);
console.log("Test digest sent — check your inbox.");
