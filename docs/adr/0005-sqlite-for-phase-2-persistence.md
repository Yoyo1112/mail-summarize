# SQLite (built into Node) for Phase 2 persistence

Phase 2 needs somewhere to keep Summaries and Detected Events between the scheduled
run that writes them and the web app that reads them ([ADR-0002](./0002-no-raw-email-content-persisted.md)
already fixes *what* is stored: derived text and event metadata, never raw message
bodies). We use SQLite through Node's built-in `node:sqlite`, with the database as a
single file on disk.

Phase 2 is explicitly single-User and runs on the operator's own machine — no
deployment, no concurrent writers, no network access to the data. A single file
matches that exactly, and needs no service to install, start, or keep running. Using
`node:sqlite` rather than a driver package also means no new dependency and no native
module to compile, which keeps `npm install` working on a fresh machine without a
toolchain. On Node 22 it needs `--experimental-sqlite`, which the npm scripts pass; the
flag disappears once the project moves to Node 24, where the module is stable.

We considered starting on Postgres, which [ADR-0004](./0004-managed-cloud-paas-deployment.md)
implies for the Phase 3 managed deployment. Rejected for now: it buys nothing while
there is one User on one machine, and costs a service to run during exactly the phase
whose purpose is judging whether detection quality is good enough to keep building on.
The schema is ordinary SQL with no SQLite-specific features, so moving it to Postgres in
Phase 3 is a migration of data, not a rewrite of the application — and that migration is
work we would rather do once we know Phase 2 is worth keeping.

The database file is local state, not source, so it is git-ignored. Losing it costs a
re-run, not data the operator authored.
