import "dotenv/config";

/**
 * One-time setup: run `npm run auth:gmail`, follow the printed instructions,
 * then copy the printed refresh token into GOOGLE_REFRESH_TOKEN in .env.
 *
 * Requires an OAuth client of type "TVs and Limited Input devices" from
 * Google Cloud Console — see README.md for the exact steps.
 */

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

async function requestDeviceCode() {
  const response = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
    }),
  });
  if (!response.ok) throw new Error(`Device code request failed: ${await response.text()}`);
  return (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_url: string;
    interval: number;
    expires_in: number;
  };
}

async function pollForToken(deviceCode: string, intervalSeconds: number, expiresInSeconds: number) {
  const deadline = Date.now() + expiresInSeconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const json = (await response.json()) as { error?: string; refresh_token?: string };
    if (response.ok && json.refresh_token) return json.refresh_token;
    if (json.error && json.error !== "authorization_pending" && json.error !== "slow_down") {
      throw new Error(`Token request failed: ${JSON.stringify(json)}`);
    }
  }
  throw new Error("Timed out waiting for authorization.");
}

async function main() {
  const { device_code, user_code, verification_url, interval, expires_in } = await requestDeviceCode();

  console.log(`\n1. Open ${verification_url}`);
  console.log(`2. Enter this code: ${user_code}\n`);
  console.log("Waiting for you to authorize...");

  const refreshToken = await pollForToken(device_code, interval, expires_in);
  console.log("\nSuccess. Add this to .env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
