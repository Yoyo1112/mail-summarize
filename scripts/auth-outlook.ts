import "dotenv/config";

/**
 * One-time setup: run `npm run auth:outlook`, follow the printed instructions,
 * then copy the printed refresh token into MICROSOFT_REFRESH_TOKEN in .env.
 *
 * Requires an Azure app registration with "Allow public client flows" enabled —
 * see README.md for the exact steps.
 */

const clientId = process.env.MICROSOFT_CLIENT_ID;
const tenantId = process.env.MICROSOFT_TENANT_ID ?? "consumers";
const scope = "https://graph.microsoft.com/Mail.Read offline_access";

if (!clientId) {
  console.error("Set MICROSOFT_CLIENT_ID in .env first.");
  process.exit(1);
}

async function requestDeviceCode() {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId!, scope }),
  });
  if (!response.ok) throw new Error(`Device code request failed: ${await response.text()}`);
  return (await response.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    expires_in: number;
  };
}

async function pollForToken(deviceCode: string, intervalSeconds: number, expiresInSeconds: number) {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const json = (await response.json()) as { error?: string; refresh_token?: string };
    if (response.ok && json.refresh_token) return json.refresh_token;
    if (json.error === "authorization_pending") continue;
    if (json.error === "slow_down") {
      interval += 5;
      continue;
    }
    if (json.error) throw new Error(`Token request failed: ${JSON.stringify(json)}`);
  }
  throw new Error("Timed out waiting for authorization.");
}

async function main() {
  const { device_code, user_code, verification_uri, interval, expires_in } = await requestDeviceCode();

  console.log(`\n1. Open ${verification_uri}`);
  console.log(`2. Enter this code: ${user_code}\n`);
  console.log("Waiting for you to authorize...");

  const refreshToken = await pollForToken(device_code, interval, expires_in);
  console.log("\nSuccess. Add this to .env:\n");
  console.log(`MICROSOFT_REFRESH_TOKEN=${refreshToken}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
