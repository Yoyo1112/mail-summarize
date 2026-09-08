/**
 * Stand-in for the Phase 2 API described in the handoff. There is no backend yet
 * (see web/README.md), so these resolve against fixtures instead of fetching.
 *
 * The signatures match the specified endpoints, so wiring the real server means
 * replacing the bodies here and nothing else:
 *   POST /events/:id/confirm { calendarId } -> provider event id | typed error
 *   POST /events/:id/ignore
 *   POST /events/:id/restore
 *   DELETE /events/:id/confirm  (undo)
 */
import type { ConfirmError } from "../types";

export type ConfirmResult =
  | { ok: true; providerEventId: string; providerEventUrl: string | null }
  | { ok: false; error: ConfirmError };

/**
 * Lets the write-failure state from option 1d be exercised without a backend:
 * load the page with ?simulate=write-failure. Remove once the real API lands.
 */
function simulatedFailure(): ConfirmError | null {
  if (typeof window === "undefined") return null;
  const simulate = new URLSearchParams(window.location.search).get("simulate");
  if (simulate !== "write-failure") return null;

  const stamp = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  return {
    code: "token_expired",
    message: "Could not write · token expired",
    diagnostic: `401 invalid_grant · ${stamp}`,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function confirmEvent(_id: string, _calendarId: string): Promise<ConfirmResult> {
  await delay(450);

  const failure = simulatedFailure();
  if (failure) return { ok: false, error: failure };

  return {
    ok: true,
    providerEventId: `evt_${Math.random().toString(36).slice(2, 10)}`,
    // The real API returns the provider's event link; nothing to link to yet.
    providerEventUrl: null,
  };
}

export async function ignoreEvent(_id: string): Promise<void> {
  await delay(150);
}

export async function restoreEvent(_id: string): Promise<void> {
  await delay(150);
}

/** Undo a Confirmation — deletes the created event and returns the row to pending. */
export async function undoConfirm(_id: string): Promise<void> {
  await delay(250);
}
