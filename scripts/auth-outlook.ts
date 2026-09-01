import "dotenv/config";
import { PublicClientApplication } from "@azure/msal-node";

/**
 * One-time setup: run `npm run auth:outlook`, follow the printed instructions,
 * then copy the printed refresh token into MICROSOFT_REFRESH_TOKEN in .env.
 *
 * Uses msal-node instead of a hand-rolled device-code HTTP client: personal
 * (consumer) Microsoft accounts go through an extra "transfer sign-in state
 * to the device" step that a bare implementation of the protocol kept
 * failing on (missing redirect_uri, then missing response_type -- Microsoft's
 * own internal handoff, not something this app's requests were missing).
 * MSAL handles that correctly; the refresh token isn't exposed by its public
 * API, so it's read out of the serialized token cache instead (documented,
 * supported use case for migrating off a raw refresh token store).
 *
 * Requires an Azure app registration with "Allow public client flows" set to
 * Yes AND a "Mobile and desktop applications" redirect URI registered
 * (https://login.microsoftonline.com/common/oauth2/nativeclient) — see
 * README.md for the exact steps.
 */

const clientId = process.env.MICROSOFT_CLIENT_ID;
const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

if (!clientId) {
  console.error("Set MICROSOFT_CLIENT_ID in .env first.");
  process.exit(1);
}

async function main() {
  const pca = new PublicClientApplication({
    auth: { clientId: clientId!, authority: `https://login.microsoftonline.com/${tenantId}` },
  });

  const result = await pca.acquireTokenByDeviceCode({
    scopes: ["https://graph.microsoft.com/Mail.Read"],
    deviceCodeCallback: (response) => console.log(`\n${response.message}\n`),
  });

  if (!result) {
    throw new Error("Authorization did not return a result.");
  }

  const cache = JSON.parse(pca.getTokenCache().serialize()) as {
    RefreshToken?: Record<string, { secret: string }>;
  };
  const refreshTokens = Object.values(cache.RefreshToken ?? {});
  if (refreshTokens.length === 0) {
    throw new Error("No refresh token found in the token cache after authorization.");
  }

  console.log("Success. Add this to .env:\n");
  console.log(`MICROSOFT_REFRESH_TOKEN=${refreshTokens[0]!.secret}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
