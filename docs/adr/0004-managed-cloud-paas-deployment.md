# Deploy to a managed cloud PaaS rather than self-hosting

The app runs on a managed platform (e.g. Vercel for the application, a hosted Postgres such as Supabase/Neon for the database) rather than on a self-hosted server on the User's own hardware or network.

Considered self-hosting to avoid any hosting cost and keep data fully under the User's control. Rejected because friends and family need the Digest schedule to keep running reliably even when the User's home network or machine is down, and self-hosting would push certificate management, uptime, and dynamic DNS/port-forwarding onto the User. At the expected scale (single-digit to low-teens Users), managed PaaS pricing is expected to stay free or near-free, so the ops savings aren't offset by meaningful cost.

**Amendment**: Vercel's Hobby (free) tier only accepts cron expressions that fire once per day — anything more frequent fails at deploy time. Since the minimum Digest frequency is 30 minutes, the Digest schedule is triggered by an external free scheduler (e.g. a GitHub Actions workflow on a cron schedule) calling the app's API route over HTTP, rather than by Vercel's own Cron Jobs feature. This keeps the app on the free tier; Vercel's cron limit only restricts its own built-in scheduler, not how often an external caller may hit an API route.
