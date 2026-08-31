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

export function passesCoarseFilter(email: NormalizedEmail): boolean {
  return !NOISE_PATTERNS.some((pattern) => pattern.test(email.from));
}
