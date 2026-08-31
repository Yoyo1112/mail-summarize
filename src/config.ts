import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),

  google: {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    refreshToken: required("GOOGLE_REFRESH_TOKEN"),
  },

  microsoft: {
    clientId: required("MICROSOFT_CLIENT_ID"),
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "consumers",
    refreshToken: required("MICROSOFT_REFRESH_TOKEN"),
  },

  resend: {
    apiKey: required("RESEND_API_KEY"),
    fromEmail: required("DIGEST_FROM_EMAIL"),
    toEmail: required("DIGEST_TO_EMAIL"),
  },

  lookbackHours: Number(process.env.LOOKBACK_HOURS ?? "6"),
};
