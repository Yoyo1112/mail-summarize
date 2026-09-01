import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";

/**
 * One-time setup: run `npm run auth:outlook`, follow the printed instructions,
 * then copy the printed refresh token into MICROSOFT_REFRESH_TOKEN in .env.
 *
 * Uses the authorization-code + PKCE + loopback-redirect flow, not the
 * device-code flow. For personal (consumer) Microsoft accounts, device code
 * relies on an internal "transfer sign-in state to the device" step that
 * currently breaks (Microsoft's own https://.../oauth2/nativeclient redirect
 * now bounces to /wrongplace and loses the code -- a known, widely reported
 * issue on Microsoft's side, confirmed against
 * https://github.com/abraunegg/onedrive/discussions/3558 -- not something
 * this app can work around). A normal browser-redirect flow to a loopback
 * address we control sidesteps that broken internal step entirely.
 *
 * Requires an Azure app registration with "Allow public client flows" set to
 * Yes AND "http://localhost" added as a redirect URI under the "Mobile and
 * desktop applications" platform (the port is ignored for localhost redirect
 * URIs, so no exact port needs registering) — see README.md.
 */

const clientId = process.env.MICROSOFT_CLIENT_ID;
const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

if (!clientId) {
  console.error("Set MICROSOFT_CLIENT_ID in .env first.");
  process.exit(1);
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function waitForAuthorizationCode(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      res.setHeader("Content-Type", "text/html");
      res.end(
        error
          ? `<p>Authorization failed: ${error}. You can close this tab.</p>`
          : "<p>Authorized. You can close this tab and go back to the terminal.</p>",
      );
      server.close();

      if (error) reject(new Error(`Microsoft returned an error: ${error} - ${errorDescription}`));
      else if (state !== expectedState) reject(new Error("State mismatch — possible CSRF, aborting."));
      else if (code) resolve(code);
      else reject(new Error("No authorization code in the redirect."));
    });

    server.listen(port);
  });
}

async function main() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  server.close();

  const redirectUri = `http://localhost:${port}`;

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "https://graph.microsoft.com/Mail.Read offline_access");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(`\nOpen this URL and authorize with your Outlook account:\n\n${authUrl.toString()}\n`);
  console.log("Waiting for you to authorize...");

  const code = await waitForAuthorizationCode(port, state);

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const json = (await tokenResponse.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !json.refresh_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  }

  console.log("\nSuccess. Add this to .env:\n");
  console.log(`MICROSOFT_REFRESH_TOKEN=${json.refresh_token}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
