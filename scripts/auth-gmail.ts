import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";

/**
 * One-time setup: run `npm run auth:gmail`, follow the printed instructions,
 * then copy the printed refresh token into GOOGLE_REFRESH_TOKEN in .env.
 *
 * Gmail scopes are not allowed on Google's device-code flow (confirmed against
 * https://developers.google.com/identity/protocols/oauth2/limited-input-device —
 * only email/profile/openid, two Drive scopes, and YouTube scopes are permitted
 * there). This instead uses the loopback-redirect flow for a "Desktop app"
 * OAuth client — see README.md for the exact Google Cloud Console steps.
 */

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function waitForAuthorizationCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.setHeader("Content-Type", "text/html");
      res.end(
        error
          ? `<p>Authorization failed: ${error}. You can close this tab.</p>`
          : "<p>Authorized. You can close this tab and go back to the terminal.</p>",
      );

      server.close();
      if (error) reject(new Error(`Google returned an error: ${error}`));
      else if (code) resolve(code);
      else reject(new Error("No authorization code in the redirect."));
    });

    // No host given: binds every interface, so it answers "localhost" whichever
    // of ::1 / 127.0.0.1 the OS resolves it to. Google's loopback exemption for
    // Desktop app clients only recognizes a "localhost" redirect_uri, not a bare
    // 127.0.0.1 IP literal — using the IP gets classified as a generic (blocked)
    // flow ("flowName=GeneralOAuthFlow") even on a genuine Desktop app client.
    server.listen(port);
  });
}

async function main() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());

  // Bind first so we know which port was actually assigned before building the redirect_uri.
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  server.close();

  const redirectUri = `http://localhost:${port}`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // forces a refresh_token even on repeat runs
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(`\nOpen this URL and authorize with your Gmail account:\n\n${authUrl.toString()}\n`);
  console.log("Waiting for you to authorize...");

  const codePromise = waitForAuthorizationCode(port);
  const code = await codePromise;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
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
  console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
