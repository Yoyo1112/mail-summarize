# Confirmation never happens via a link inside a Digest email

Digest emails are notification-only: they tell the User a Digest is ready and link to the web app, where Confirmation of Detected Events actually happens after login. No email contains a link that itself triggers a write (e.g. "confirm and add to calendar").

The obvious-looking alternative — a one-click confirm link in the email — is rejected on purpose: corporate mail gateways commonly pre-fetch/auto-click links in incoming mail for security scanning, which would silently trigger the write before the User ever reads the message. Centralizing all state-changing actions behind an authenticated web session avoids that failure mode entirely.
