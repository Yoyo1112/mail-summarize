import { google } from "googleapis";
import { config } from "../config.js";
import type { NormalizedEmail } from "./types.js";

function client() {
  const auth = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
  auth.setCredentials({ refresh_token: config.google.refreshToken });
  return google.gmail({ version: "v1", auth });
}

function headerValue(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

/** Walks a Gmail message payload for the first text/plain part, falling back to text/html stripped of tags. */
function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const found = extractBody(part);
    if (found) return found;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

/** Fetches mail received in the last `lookbackHours`. Nothing is persisted — see docs/adr/0002. */
export async function fetchRecentGmail(lookbackHours: number): Promise<NormalizedEmail[]> {
  const gmail = client();
  const afterEpochSeconds = Math.floor(Date.now() / 1000 - lookbackHours * 3600);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `after:${afterEpochSeconds} -in:chats`,
    maxResults: 50,
  });

  const messages = list.data.messages ?? [];
  const emails: NormalizedEmail[] = [];

  for (const message of messages) {
    if (!message.id) continue;
    const full = await gmail.users.messages.get({ userId: "me", id: message.id, format: "full" });
    const headers = full.data.payload?.headers ?? [];
    const body = extractBody(full.data.payload);

    emails.push({
      provider: "gmail",
      id: message.id,
      from: headerValue(headers, "From"),
      subject: headerValue(headers, "Subject"),
      receivedAt: new Date(Number(full.data.internalDate ?? Date.now())).toISOString(),
      snippet: body.slice(0, 2000) || (full.data.snippet ?? ""),
    });
  }

  return emails;
}
