import { config } from "../config.js";
import type { NormalizedEmail } from "./types.js";

const GRAPH_SCOPE = "https://graph.microsoft.com/Mail.Read offline_access";

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.microsoft.clientId,
    grant_type: "refresh_token",
    refresh_token: config.microsoft.refreshToken,
    scope: GRAPH_SCOPE,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed (${response.status}): ${await response.text()}`);
  }

  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

interface GraphMessage {
  id: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  subject?: string;
  receivedDateTime: string;
  bodyPreview?: string;
}

/**
 * The address of the connected mailbox — the Mail Account, in CONTEXT.md's terms.
 *
 * Reading /me needs the User.Read scope, which the current Mail.Read-only token does
 * not carry, so this falls back to OUTLOOK_ACCOUNT_EMAIL rather than forcing a
 * re-consent. Set that variable to skip the request entirely.
 */
export async function getOutlookAccountEmail(): Promise<string> {
  if (config.microsoft.accountEmail) return config.microsoft.accountEmail;

  try {
    const accessToken = await getAccessToken();
    const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return "";
    const json = (await response.json()) as { mail?: string; userPrincipalName?: string };
    return json.mail ?? json.userPrincipalName ?? "";
  } catch {
    return "";
  }
}

/** Fetches mail received in the last `lookbackHours`. Nothing is persisted — see docs/adr/0002. */
export async function fetchRecentOutlook(lookbackHours: number): Promise<NormalizedEmail[]> {
  const accessToken = await getAccessToken();
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();

  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$filter", `receivedDateTime ge ${since}`);
  url.searchParams.set("$select", "id,from,subject,receivedDateTime,bodyPreview");
  url.searchParams.set("$top", "50");
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph fetch failed (${response.status}): ${await response.text()}`);
  }

  const json = (await response.json()) as { value: GraphMessage[] };

  return json.value.map((message) => ({
    provider: "outlook" as const,
    id: message.id,
    from: message.from?.emailAddress?.address ?? message.from?.emailAddress?.name ?? "",
    fromName: message.from?.emailAddress?.name,
    subject: message.subject ?? "",
    receivedAt: message.receivedDateTime,
    snippet: (message.bodyPreview ?? "").slice(0, 2000),
  }));
}
