import { config } from "../config.js";
import { parseSender } from "../mail/sender.js";
import type { NormalizedEmail } from "../mail/types.js";

/**
 * Cheap, deterministic first pass: drops obvious noise before anything reaches the LLM.
 * Intentionally conservative — false negatives here are cheap to fix later (tune the
 * patterns), false positives mean a real email never even gets an LLM judgment.
 */
const NOISE_PATTERNS = [
  /no-?reply@/i,
  /notifications?@/i,
  /newsletter@/i,
  /marketing@/i,
  /^info@/i,
  /mailer-daemon@/i,
];

/**
 * The digest lands in the same inbox it is built from, so without this every run would
 * feed the previous run's digest back into Triage — and it reads as important, because
 * it is a summary of important mail. Matched on the configured sender rather than a
 * literal address so changing DIGEST_FROM_EMAIL does not silently reopen the loop.
 */
function isOwnDigest(email: NormalizedEmail): boolean {
  const digestSender = config.resend.fromEmail.trim().toLowerCase();
  if (!digestSender) return false;
  return parseSender(email).email.toLowerCase() === digestSender;
}

export function passesCoarseFilter(email: NormalizedEmail): boolean {
  if (isOwnDigest(email)) return false;
  return !NOISE_PATTERNS.some((pattern) => pattern.test(email.from));
}
