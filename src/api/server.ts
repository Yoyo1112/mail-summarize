import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { config } from "../config.js";
import { describeError } from "../errors.js";
import {
  LAST_RUN_AT,
  countSummaries,
  getEvent,
  getMeta,
  ignoreEvent,
  listEventsByStatus,
  listRecentSummaries,
  markConfirmed,
  recordConfirmError,
  restoreEvent,
  setTargetCalendar,
} from "../store/repository.js";
import type { DetectedEventStatus, StoredDetectedEvent, StoredSummary } from "../store/types.js";
import { deleteEvent, writeEvent } from "../calendar/index.js";
import { CalendarWriteError, type ConfirmError, type ConfirmErrorCode } from "../calendar/types.js";
import { calendarAccess, defaultCalendarId } from "./calendars.js";

const STATUSES: DetectedEventStatus[] = ["pending", "confirmed", "ignored"];

/** Wire shapes match web/src/types.ts so the client needs no translation layer. */
function toWireEvent(event: StoredDetectedEvent) {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    source: event.provider,
    sourceAccountEmail: event.sourceAccountEmail,
    senderName: event.senderName,
    senderEmail: event.senderEmail,
    subject: event.subject,
    detectedAt: event.detectedAt,
    status: event.status,
    targetCalendarId: event.targetCalendarId ?? defaultCalendarId(event.provider) ?? "",
    error: event.errorCode
      ? { code: event.errorCode, message: event.errorMessage ?? "Could not write" }
      : null,
    confirmedAt: event.confirmedAt ?? undefined,
    ignoredAt: event.ignoredAt ?? undefined,
    providerEventUrl: event.providerEventUrl,
  };
}

function toWireSummary(summary: StoredSummary) {
  return {
    id: summary.id,
    source: summary.provider,
    senderName: summary.senderName,
    senderEmail: summary.senderEmail,
    subject: summary.subject,
    summaryText: summary.summaryText,
    receivedAt: summary.receivedAt,
  };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

const WEB_DIST = resolve(process.cwd(), "web/dist");

/**
 * Serves the built web app when it exists. In development the client is served by
 * Vite instead, which proxies /api here — see web/vite.config.ts.
 */
async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  // Resolve inside web/dist only: a request path must never escape the root.
  const requested = normalize(pathname === "/" ? "/index.html" : pathname);
  const filePath = join(WEB_DIST, requested);
  if (!filePath.startsWith(WEB_DIST)) {
    json(response, 403, { error: "forbidden" });
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    try {
      // Unknown path with a built app present: hand back index.html for client routing.
      const index = await readFile(join(WEB_DIST, "index.html"));
      response.writeHead(200, { "Content-Type": MIME[".html"]! });
      response.end(index);
    } catch {
      json(response, 404, {
        error: "not_found",
        hint: "Run `npm run build` in web/, or use the Vite dev server.",
      });
    }
  }
}

const HTTP_STATUS_FOR: Record<ConfirmErrorCode, number> = {
  missing_scope: 409,
  quota_exceeded: 429,
  token_expired: 502,
  network: 502,
};

/** Any failure from a calendar write, as the typed error the card renders. */
function confirmErrorFrom(error: unknown): ConfirmError {
  if (error instanceof CalendarWriteError) return error.detail;
  console.error(`Calendar write failed: ${describeError(error)}`);
  return { code: "network", message: "Could not write · the request did not complete" };
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<boolean> {
  const { pathname } = url;
  const method = request.method ?? "GET";

  if (pathname === "/api/summaries" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") ?? "50");
    json(response, 200, {
      summaries: listRecentSummaries(Number.isFinite(limit) ? limit : 50).map(toWireSummary),
      total: countSummaries(),
    });
    return true;
  }

  if (pathname === "/api/events" && method === "GET") {
    const requested = url.searchParams.get("status") ?? "pending";
    if (!STATUSES.includes(requested as DetectedEventStatus)) {
      json(response, 400, { error: "bad_status", allowed: STATUSES });
      return true;
    }
    json(response, 200, {
      events: listEventsByStatus(requested as DetectedEventStatus).map(toWireEvent),
    });
    return true;
  }

  if (pathname === "/api/calendars" && method === "GET") {
    const access = await calendarAccess();
    json(response, 200, { calendars: access.calendars, scopeMissing: access.scopeMissing });
    return true;
  }

  if (pathname === "/api/status" && method === "GET") {
    const access = await calendarAccess();
    json(response, 200, {
      lastRunAt: getMeta(LAST_RUN_AT),
      timezone: config.timezone,
      scopeMissing: access.scopeMissing,
      accounts: access.accounts,
    });
    return true;
  }

  const eventAction = pathname.match(/^\/api\/events\/([^/]+)\/(confirm|ignore|restore)$/);
  if (eventAction) {
    const [, id, action] = eventAction as unknown as [string, string, string];

    if (action === "ignore" && method === "POST") {
      const event = ignoreEvent(id);
      if (!event) return json(response, 404, { error: "not_found" }), true;
      json(response, 200, { event: toWireEvent(event) });
      return true;
    }

    if (action === "restore" && method === "POST") {
      const event = restoreEvent(id);
      if (!event) return json(response, 404, { error: "not_found" }), true;
      json(response, 200, { event: toWireEvent(event) });
      return true;
    }

    // Undo a Confirmation: delete what was written, then return the event to Pending.
    // If the calendar delete fails the event stays confirmed — it is still on the calendar.
    if (action === "confirm" && method === "DELETE") {
      const existing = getEvent(id);
      if (!existing) return json(response, 404, { error: "not_found" }), true;

      if (existing.status === "confirmed" && existing.providerEventId && existing.targetCalendarId) {
        try {
          await deleteEvent(existing.targetCalendarId, existing.providerEventId);
        } catch (error) {
          const detail = confirmErrorFrom(error);
          json(response, HTTP_STATUS_FOR[detail.code], { error: detail });
          return true;
        }
      }

      json(response, 200, { event: toWireEvent(restoreEvent(id)!) });
      return true;
    }

    if (action === "confirm" && method === "POST") {
      const existing = getEvent(id);
      if (!existing) return json(response, 404, { error: "not_found" }), true;
      if (existing.status === "confirmed") return json(response, 200, { event: toWireEvent(existing) }), true;
      if (existing.status !== "pending") return json(response, 409, { error: "not_pending" }), true;

      const body = await readJsonBody(request);
      const requested = typeof body.calendarId === "string" ? body.calendarId : "";
      const calendarId = requested || existing.targetCalendarId || defaultCalendarId(existing.provider) || "";
      if (calendarId) setTargetCalendar(id, calendarId);

      // Nothing is reported as added to a calendar unless the provider confirmed the write.
      try {
        const written = await writeEvent(calendarId, {
          detectedEventId: existing.id,
          title: existing.title,
          startsAt: existing.startsAt,
          endsAt: existing.endsAt,
          location: existing.location,
          senderName: existing.senderName,
          senderEmail: existing.senderEmail,
          subject: existing.subject,
        });
        const event = markConfirmed(id, { calendarId, ...written });
        json(response, 200, { event: toWireEvent(event!) });
      } catch (error) {
        const detail = confirmErrorFrom(error);
        recordConfirmError(id, detail);
        json(response, HTTP_STATUS_FOR[detail.code], { error: detail });
      }
      return true;
    }
  }

  if (pathname.startsWith("/api/")) {
    json(response, 404, { error: "not_found" });
    return true;
  }

  return false;
}

export function startServer(port = Number(process.env.PORT ?? "3000")) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    handleApi(request, response, url)
      .then((handled) => {
        if (handled) return;
        return serveStatic(url.pathname, response);
      })
      .catch((error) => {
        console.error(`Request failed: ${describeError(error)}`);
        if (!response.headersSent) json(response, 500, { error: "internal_error" });
      });
  });

  server.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    console.log(`Database: ${config.databasePath}`);
  });

  return server;
}

startServer();
