import { Resend } from "resend";
import { config } from "../config.js";

const resend = new Resend(config.resend.apiKey);

export async function sendDigest(subject: string, html: string, text: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: config.resend.fromEmail,
    to: config.resend.toEmail,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Failed to send digest email: ${error.message}`);
  }
}
