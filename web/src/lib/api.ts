/**
 * Client for the Phase 2 API (src/api/server.ts). In development Vite proxies /api
 * to that server; in production the same server serves this bundle.
 */
import type { Calendar, ConfirmError, DetectedEvent, Summary } from "../types";

export type ConfirmResult =
  | { ok: true; providerEventUrl: string | null }
  | { ok: false; error: ConfirmError };

/** What the app needs to render the freshness line and the calendar-access state. */
export interface Status {
  lastRunAt: string | null;
  timezone: string;
  /** True while the connected tokens lack calendar write scopes. */
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
}

export interface ConnectedAccount {
  provider: "gmail" | "outlook";
  accountEmail: string;
  currentScope: string;
  requiredScope: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Request failed with ${status}`);
    this.name = "ApiError";
  }
}

export async function fetchStatus(): Promise<Status> {
  return request<Status>("/api/status");
}

export async function fetchEvents(
  status: DetectedEvent["status"] = "pending",
): Promise<DetectedEvent[]> {
  const body = await request<{ events: DetectedEvent[] }>(`/api/events?status=${status}`);
  return body.events;
}

export async function fetchSummaries(
  limit = 50,
): Promise<{ summaries: Summary[]; total: number }> {
  return request<{ summaries: Summary[]; total: number }>(`/api/summaries?limit=${limit}`);
}

export async function fetchCalendars(): Promise<Calendar[]> {
  const body = await request<{ calendars: Calendar[] }>("/api/calendars");
  return body.calendars;
}

/** Everything the review screen needs, in one round trip at startup. */
export async function fetchAll(): Promise<{
  status: Status;
  events: DetectedEvent[];
  summaries: Summary[];
  summaryTotal: number;
  calendars: Calendar[];
}> {
  const [status, pending, confirmed, ignored, summaries, calendars] = await Promise.all([
    fetchStatus(),
    fetchEvents("pending"),
    fetchEvents("confirmed"),
    fetchEvents("ignored"),
    fetchSummaries(),
    fetchCalendars(),
  ]);

  return {
    status,
    events: [...pending, ...confirmed, ...ignored],
    summaries: summaries.summaries,
    summaryTotal: summaries.total,
    calendars,
  };
}

export async function confirmEvent(id: string, calendarId: string): Promise<ConfirmResult> {
  try {
    const body = await request<{ event: DetectedEvent }>(`/api/events/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ calendarId }),
    });
    return { ok: true, providerEventUrl: body.event.providerEventUrl ?? null };
  } catch (error) {
    if (error instanceof ApiError) {
      const payload = error.body as { error?: ConfirmError } | null;
      if (payload?.error?.code) return { ok: false, error: payload.error };
    }
    return {
      ok: false,
      error: { code: "network", message: "Could not write · the request did not complete" },
    };
  }
}

export async function ignoreEvent(id: string): Promise<void> {
  await request(`/api/events/${id}/ignore`, { method: "POST" });
}

export async function restoreEvent(id: string): Promise<void> {
  await request(`/api/events/${id}/restore`, { method: "POST" });
}

/** Undo a Confirmation — deletes the created event and returns the row to pending. */
export async function undoConfirm(id: string): Promise<void> {
  await request(`/api/events/${id}/confirm`, { method: "DELETE" });
}
