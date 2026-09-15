import { createHash } from "node:crypto";
import { parseSender } from "./sender.js";
import type { MailProvider, NormalizedEmail } from "./types.js";

/** The message a fingerprint was first seen on. */
export interface FingerprintOwner {
  provider: MailProvider;
  messageId: string;
}

/**
 * Identifies an email by what it says rather than by its message id. Senders sometimes
 * send the same notice twice — NYCU's course office did, 27 minutes apart — and each copy
 * gets its own id, so id-based idempotency lets both through.
 *
 * Built from the sender address, subject and body text the pipeline actually reads, with
 * all whitespace removed rather than collapsed: Chinese text has no word spaces, so the
 * same message rendered from differently laid-out HTML can differ only in where a space
 * falls. Only the hash is ever stored, never the text (ADR-0002).
 */
export function contentFingerprint(email: NormalizedEmail): string {
  const normalise = (value: string) => value.replace(/\s+/g, "");
  return createHash("sha256")
    .update(parseSender(email).email.toLowerCase())
    .update("\n")
    .update(normalise(email.subject))
    .update("\n")
    .update(normalise(email.snippet))
    .digest("hex");
}

export interface Deduplicated {
  unique: NormalizedEmail[];
  duplicates: NormalizedEmail[];
  /** Fingerprints first seen in this batch, to record against the email that carried them. */
  newFingerprints: { fingerprint: string; owner: FingerprintOwner }[];
}

/**
 * Drops emails whose content was already seen — earlier in this batch, or on an earlier
 * run. Within a batch the earliest-received copy is kept.
 *
 * An email whose fingerprint belongs to its own message id is not a duplicate: that is
 * the same message coming round again in an overlapping window, and the stores already
 * handle it idempotently.
 */
export function dropDuplicates(
  emails: NormalizedEmail[],
  knownOwners: Map<string, FingerprintOwner>,
): Deduplicated {
  const byAge = [...emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const owners = new Map(knownOwners);
  const result: Deduplicated = { unique: [], duplicates: [], newFingerprints: [] };

  for (const email of byAge) {
    const fingerprint = contentFingerprint(email);
    const owner = owners.get(fingerprint);

    if (!owner) {
      const self = { provider: email.provider, messageId: email.id };
      owners.set(fingerprint, self);
      result.newFingerprints.push({ fingerprint, owner: self });
      result.unique.push(email);
    } else if (owner.provider === email.provider && owner.messageId === email.id) {
      result.unique.push(email);
    } else {
      result.duplicates.push(email);
    }
  }

  // Keep the caller's order — providers return newest first, and the digest follows it.
  const kept = new Set(result.unique);
  result.unique = emails.filter((email) => kept.has(email));
  return result;
}
