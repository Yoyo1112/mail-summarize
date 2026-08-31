import type { TriagedEmail } from "../triage/run.js";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Builds the Digest email body. See CONTEXT.md: Digest, Summary. */
export function composeDigest(items: TriagedEmail[]): { subject: string; html: string; text: string } {
  const now = new Date().toLocaleString();

  if (items.length === 0) {
    return {
      subject: "Mail Digest — nothing new",
      html: `<p>No important emails since the last digest. (${escapeHtml(now)})</p>`,
      text: `No important emails since the last digest. (${now})`,
    };
  }

  const rows = items.map(({ email, summary }) => ({
    provider: email.provider,
    from: email.from,
    subject: email.subject || "(no subject)",
    summary,
  }));

  const html = [
    `<h2>Mail Digest — ${items.length} important email${items.length === 1 ? "" : "s"}</h2>`,
    ...rows.map(
      (row) =>
        `<div style="margin-bottom:16px">` +
        `<div style="font-size:12px;color:#666;text-transform:uppercase">${escapeHtml(row.provider)}</div>` +
        `<div style="font-weight:600">${escapeHtml(row.subject)}</div>` +
        `<div style="font-size:13px;color:#444">${escapeHtml(row.from)}</div>` +
        `<div style="margin-top:4px">${escapeHtml(row.summary)}</div>` +
        `</div>`,
    ),
  ].join("\n");

  const text = rows.map((row) => `[${row.provider}] ${row.subject}\n${row.from}\n${row.summary}`).join("\n\n");

  return { subject: `Mail Digest — ${items.length} important email${items.length === 1 ? "" : "s"}`, html, text };
}
