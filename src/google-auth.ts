import { google } from "googleapis";
import { config } from "./config.js";

let oauthClient: InstanceType<typeof google.auth.OAuth2> | null = null;

/**
 * One OAuth client for every Google API this app calls, so Gmail reads and Calendar
 * writes share a refreshed access token instead of each refreshing their own.
 */
export function googleAuth(): InstanceType<typeof google.auth.OAuth2> {
  if (oauthClient) return oauthClient;
  oauthClient = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret);
  oauthClient.setCredentials({ refresh_token: config.google.refreshToken });
  return oauthClient;
}

const SCOPE_CACHE_MS = 5 * 60 * 1000;
let scopeCache: { scopes: string[]; at: number } | null = null;

/**
 * The scopes the connected Google token actually holds, read from Google rather than
 * assumed — re-running `npm run auth:gmail` with wider scopes is what grants calendar
 * access, and the UI must reflect that without a code change. Cached briefly; call
 * `forgetGoogleScopes` after a write fails for lack of permission.
 */
export async function googleScopes(): Promise<string[]> {
  if (scopeCache && Date.now() - scopeCache.at < SCOPE_CACHE_MS) return scopeCache.scopes;
  const auth = googleAuth();
  const { token } = await auth.getAccessToken();
  const info = token ? await auth.getTokenInfo(token) : { scopes: [] as string[] };
  scopeCache = { scopes: info.scopes ?? [], at: Date.now() };
  return scopeCache.scopes;
}

export function forgetGoogleScopes(): void {
  scopeCache = null;
}
