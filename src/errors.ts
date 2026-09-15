/**
 * A loggable description of an error that never includes the request that caused it.
 *
 * Printing an error object directly is not safe here: googleapis throws a GaxiosError
 * whose `config` holds the request body, and gaxios's redactor misses `refresh_token` —
 * so a failed token refresh printed the live Gmail refresh token in plaintext. This keeps
 * what is useful for diagnosis (message, stack, the provider's own status and error text)
 * and drops everything else.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const lines = [error.stack ?? `${error.name}: ${error.message}`];
  const response = (error as { response?: { status?: unknown; data?: unknown } }).response;
  if (response) {
    const data = response.data as { error?: unknown; error_description?: unknown } | undefined;
    const detail = [data?.error, data?.error_description]
      .map((part) => (typeof part === "string" ? part : part ? JSON.stringify(part) : ""))
      .filter(Boolean)
      .join(": ");
    lines.push(`Provider response: ${response.status ?? "unknown status"}${detail ? ` ${detail}` : ""}`);
  }
  return lines.join("\n");
}
