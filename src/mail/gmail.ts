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

/**
 * Picks the readable body of a Gmail message: the text/plain part when it is usable,
 * otherwise the text/html part reduced to text.
 */
function extractBody(payload: any): string {
  const parts = { plain: "", html: "" };
  collectParts(payload, parts);
  if (parts.plain && !looksLikeLeakedCss(parts.plain)) return parts.plain;
  if (parts.html) return htmlToText(parts.html);
  return parts.plain;
}

/** Records the first text/plain and first text/html part found, depth first. */
function collectParts(payload: any, parts: { plain: string; html: string }): void {
  if (!payload) return;
  if (payload.body?.data) {
    if (payload.mimeType === "text/plain" && !parts.plain) parts.plain = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html" && !parts.html) parts.html = decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) collectParts(part, parts);
}

/**
 * Some senders (1111 Job Bank, for one) generate the text/plain part by stripping tags
 * from their HTML, which leaves the stylesheet in as prose. A few CSS rules is enough
 * to tell — ordinary mail almost never contains `selector { property: value }`.
 */
function looksLikeLeakedCss(text: string): boolean {
  return (text.match(/[\w\-.#@\]]\s*\{[^{}]*:[^{}]*\}/g) ?? []).length >= 3;
}

const HTML_ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

/**
 * Reduces an HTML body to its readable text. Stripping tags alone is not enough: the
 * contents of <style> and <script> are text too, and templated mail (job boards,
 * booking sites) can open with enough CSS to fill the whole 2000-character budget
 * before the first real sentence.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, name: string) => HTML_ENTITIES[name] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The address of the connected mailbox — the Mail Account, in CONTEXT.md's terms.
 * Covered by the existing gmail.readonly scope, so this needs no re-consent.
 */
export async function getGmailAccountEmail(): Promise<string> {
  if (config.google.accountEmail) return config.google.accountEmail;
  const profile = await client().users.getProfile({ userId: "me" });
  return profile.data.emailAddress ?? "";
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
