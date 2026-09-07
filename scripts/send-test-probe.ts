import "dotenv/config";
import { Resend } from "resend";
import { config } from "../src/config.js";

/**
 * Sends one throwaway email to DIGEST_TO_EMAIL so you have something fresh
 * to check the fetch step against — run `npm run digest` right after this
 * and see whether the count of fetched emails includes it, and whether
 * Triage judged it important. Not part of the real pipeline.
 */

const resend = new Resend(config.resend.apiKey);

const { error } = await resend.emails.send({
  from: config.resend.fromEmail,
  to: config.resend.toEmail,
  subject: "[test] Project deadline moved up to this Friday",
  text: "Hi — just a heads up that the project deadline has been moved up to this Friday at 5pm. Please make sure your part is ready by then. Thanks!",
});

if (error) {
  console.error("Failed to send test probe:", error);
  process.exit(1);
}

console.log(`Test probe sent to ${config.resend.toEmail}. Run "npm run digest" now to see if it gets picked up.`);
