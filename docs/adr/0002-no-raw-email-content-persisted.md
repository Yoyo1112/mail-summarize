# Never persist raw email content — only derived Summaries and Detected Event metadata

Each Digest cycle fetches mail live from the Gmail/Outlook APIs, runs Triage and summarization, and discards the original message bodies once a Summary (and any Detected Events) has been produced. Only the Summary text and Detected Event metadata are written to the database.

We considered also caching raw content so the web app could show the original message. Rejected: the app stores other people's mail (friends' and family's, once multi-User), not just the operator's own, and a database breach or leak should expose only generated summaries, not full inboxes. Reintroducing raw storage later means re-architecting both the pipeline and the retention/consent story, so this is deliberately the conservative default rather than something to loosen if convenience is missed later.
