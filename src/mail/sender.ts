import type { NormalizedEmail } from "./types.js";

export interface Sender {
  name: string;
  email: string;
}

/**
 * Splits a sender into a display name and an address.
 *
 * Gmail hands over the raw From header (`Priya Raman <priya@acme.co>`); Outlook hands
 * over the bare address plus the name separately. When there is no name to be had, the
 * address doubles as the name — better than showing an empty sender in the UI.
 */
export function parseSender(email: NormalizedEmail): Sender {
  const raw = email.from.trim();
  const angled = raw.match(/^(.*?)<([^>]+)>\s*$/);

  const address = (angled ? angled[2] : raw)?.trim() ?? "";
  const headerName = angled?.[1]?.trim().replace(/^"(.*)"$/, "$1") ?? "";
  const name = email.fromName?.trim() || headerName || address;

  return { name, email: address };
}
