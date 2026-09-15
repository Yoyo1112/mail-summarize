/**
 * Splits items into consecutive batches of at most `size`.
 *
 * Triage and event detection each answer a whole batch in one structured response
 * with a fixed output budget, so the batch has to stay small enough for every
 * email's answer to fit — however many emails a long lookback window fetched.
 */
export function inBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
