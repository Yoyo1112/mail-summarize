import { google } from "googleapis";
import { config } from "../config.js";
import { googleAuth } from "../google-auth.js";
import { MAX_MESSAGES_PER_RUN, type NormalizedEmail } from "./types.js";

function client() {
  return google.gmail({ version: "v1", auth: googleAuth() });
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

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
const MAX_RATE_LIMIT_RETRIES = 6;

/**
 * Retries a Gmail call that was throttled, backing off 2s, 4s, 8s… up to a minute.
 *
 * Fetching a long window means one messages.get per email, and this project's per-user
 * quota ran out after about 175 of them (277 in a 7-day window). Gmail reports that as
 * 403 rateLimitExceeded, which googleapis's built-in retry (429 and 5xx only) does not
 * cover. Any other error is rethrown at once.
 */
async function withRateLimitRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: any } }).response;
      const reason = response?.data?.error?.errors?.[0]?.reason;
      const throttled = response?.status === 429 || (response?.status === 403 && RATE_LIMIT_REASONS.has(reason));
      if (!throttled || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;

      const delayMs = Math.min(60_000, 2_000 * 2 ** attempt);
      console.warn(`Gmail: rate limited, retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Fetches mail received in the last `lookbackHours`. Nothing is persisted — see docs/adr/0002. */
export async function fetchRecentGmail(lookbackHours: number): Promise<NormalizedEmail[]> {
  const gmail = client();
  const afterEpochSeconds = Math.floor(Date.now() / 1000 - lookbackHours * 3600);

  const messages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const list = await withRateLimitRetry(() =>
      gmail.users.messages.list({
        userId: "me",
        q: `after:${afterEpochSeconds} -in:chats`,
        maxResults: 100,
        pageToken,
      }),
    );
    messages.push(...(list.data.messages ?? []));
    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken && messages.length < MAX_MESSAGES_PER_RUN);

  if (messages.length >= MAX_MESSAGES_PER_RUN) {
    console.warn(
      `Gmail: stopped at ${MAX_MESSAGES_PER_RUN} messages; older mail in the ${lookbackHours}h window was not fetched.`,
    );
    messages.length = MAX_MESSAGES_PER_RUN;
  }

  const emails: NormalizedEmail[] = [];

  for (const message of messages) {
    if (!message.id) continue;
    const id = message.id;
    const full = await withRateLimitRetry(() =>
      gmail.users.messages.get({ userId: "me", id, format: "full" }),
    );
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
