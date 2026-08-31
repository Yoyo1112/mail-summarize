import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "../config.js";
import type { NormalizedEmail } from "../mail/types.js";
import { passesCoarseFilter } from "./rules.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const TriageResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().describe("Must exactly match the id of the email this judgment is for."),
      important: z.boolean().describe("True if this email is worth surfacing to the reader."),
      summary: z
        .string()
        .nullable()
        .describe("One or two sentence summary in the email's own language. Null when important is false."),
    }),
  ),
});

export interface TriagedEmail {
  email: NormalizedEmail;
  summary: string;
}

/** Rule-based coarse filter, then a single batched LLM call for the survivors. See CONTEXT.md: Triage. */
export async function triage(emails: NormalizedEmail[]): Promise<TriagedEmail[]> {
  const candidates = emails.filter(passesCoarseFilter);
  if (candidates.length === 0) return [];

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system:
      "You triage a personal inbox. For each email, decide whether it is important enough to " +
      "surface in a digest (skip routine confirmations, receipts, social notifications, and " +
      "promotional content unless it contains a genuine deadline or action the reader must take). " +
      "For important emails, write a one-to-two sentence summary in the same language as the email. " +
      "Return exactly one result per input email, matching by id.",
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          candidates.map((email) => ({
            id: email.id,
            from: email.from,
            subject: email.subject,
            receivedAt: email.receivedAt,
            body: email.snippet,
          })),
        ),
      },
    ],
    output_config: { format: zodOutputFormat(TriageResultSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Triage response failed to parse against the expected schema.");
  }

  const byId = new Map(candidates.map((email) => [email.id, email]));
  const triaged: TriagedEmail[] = [];

  for (const result of parsed.results) {
    const email = byId.get(result.id);
    if (!email || !result.important || !result.summary) continue;
    triaged.push({ email, summary: result.summary });
  }

  return triaged;
}
