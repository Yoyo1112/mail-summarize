import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { config } from "../config.js";
import type { TriagedEmail } from "../triage/run.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const ExtractionSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().describe("Must exactly match the id of the email this is for."),
      events: z
        .array(
          z.object({
            title: z
              .string()
              .describe(
                "Short calendar title in the email's own language, e.g. 'Design review — Q4 roadmap'.",
              ),
            startsAt: z
              .string()
              .describe(
                "ISO 8601 with an explicit UTC offset, e.g. 2026-09-10T14:00:00+08:00. " +
                  "Resolve relative dates ('next Thursday') against the email's receivedAt.",
              ),
            endsAt: z
              .string()
              .nullable()
              .describe("ISO 8601 with offset, or null when the email gives no end time."),
            location: z
              .string()
              .nullable()
              .describe("Where it happens, or null when the email gives no location. Never guess."),
          }),
        )
        .describe("Empty when the email commits the reader to nothing at a specific time."),
    }),
  ),
});

const SYSTEM_PROMPT = [
  "You extract calendar events from emails that have already been judged important.",
  "",
  "Extract an event only when the email commits the reader to being somewhere, or doing",
  "something, at a specific date and time: meetings, appointments, bookings, interviews,",
  "reservations, calls. Most emails contain no event — returning an empty list is the",
  "normal, correct answer, and a wrong event costs the reader more than a missed one.",
  "",
  "Do NOT extract:",
  "- marketing or campaign deadlines ('sale ends Sunday', 'enrol by 30 Sep')",
  "- webinars, newsletters and events the reader was merely told about, not booked into",
  "- things that already happened, described in the past tense",
  "- vague references with no specific time ('sometime next week', 'let's catch up')",
  "- recurring admin like billing dates or subscription renewals",
  "",
  "Resolve relative dates ('tomorrow', 'next Thursday') against the email's receivedAt,",
  `and express every time in ISO 8601 with an explicit offset for the ${config.timezone} timezone.`,
  "If a date is genuinely ambiguous, omit the event rather than guessing.",
  "Return exactly one result per input email, matching by id.",
].join("\n");

export interface ExtractedEvent {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
}

/** One entry per input email, in the same order. */
export interface DetectionResult {
  email: TriagedEmail["email"];
  events: ExtractedEvent[];
}

/**
 * Extracts Detected Events from emails that passed Triage.
 *
 * Deliberately a separate call from Triage rather than extra fields on that prompt:
 * Triage's importance judgment is the thing Phase 1 exists to validate, and changing
 * its prompt would silently move those results. See ROADMAP.md.
 */
export async function detectEvents(triaged: TriagedEmail[]): Promise<DetectionResult[]> {
  if (triaged.length === 0) return [];

  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          triaged.map(({ email, summary }) => ({
            id: email.id,
            from: email.from,
            subject: email.subject,
            receivedAt: email.receivedAt,
            summary,
            body: email.snippet,
          })),
        ),
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Event detection response failed to parse against the expected schema.");
  }

  const byId = new Map(triaged.map(({ email }) => [email.id, email]));
  const results: DetectionResult[] = [];

  for (const result of parsed.results) {
    const email = byId.get(result.id);
    if (!email) continue;
    results.push({ email, events: result.events.filter(isUsable) });
  }

  return results;
}

/** Drops anything whose start time the model did not return as a real date. */
function isUsable(event: ExtractedEvent): boolean {
  return event.title.trim().length > 0 && !Number.isNaN(Date.parse(event.startsAt));
}
