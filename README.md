# Mail Digest — Phase 1

Fetches recent Gmail + Outlook mail, triages it (rule filter + Claude judgment), and emails you a digest of what's important. No login, no web UI, no calendar writing yet — see [ROADMAP.md](./ROADMAP.md) for what Phase 2 and 3 add, and [CONTEXT.md](./CONTEXT.md) for the terms used below (Triage, Digest, Summary).

## One-time setup

You'll create three things yourself — a Google OAuth client, an Azure app registration, and a Resend account — then run two local scripts to get refresh tokens. None of this can be done on your behalf; each needs your own browser session signed into your own accounts.

### 1. Claude API key

Get a key from the [Anthropic Console](https://console.anthropic.com/settings/keys).

### 2. Gmail OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one).
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen** → configure it (External user type is fine — you'll stay in "Testing" status; see [ADR](./docs/adr/) history for why that's fine for personal use). Add your own Gmail address under **Test users**.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Desktop app**. (Not "TVs and Limited Input devices" — Google's device-code flow doesn't allow Gmail scopes at all, so `auth:gmail` below uses a local-loopback flow instead, which needs a Desktop app client.)
5. Copy the **Client ID** and **Client secret** into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 3. Outlook (Microsoft) app registration

1. In the [Azure Portal](https://portal.azure.com/) → **App registrations → New registration**.
2. Name it anything. Supported account types: **Personal Microsoft accounts only** (or "Accounts in any organizational directory and personal Microsoft accounts" if you also want a work/school inbox later — note a work/school tenant may require IT admin approval before you can consent, which is outside this app's control).
3. After creation, go to **Authentication** → **Add a platform → Mobile and desktop applications** → add `http://localhost` as a redirect URI (the port is ignored for localhost redirect URIs, so no exact port needs registering — `auth:outlook` picks a free one at runtime). Do **not** rely on the suggested `https://login.microsoftonline.com/common/oauth2/nativeclient` checkbox — Microsoft's own redirect for that URI is currently broken (bounces to `/wrongplace` and loses the auth code; see [this report](https://github.com/abraunegg/onedrive/discussions/3558)).
4. Still on **Authentication**, under **Advanced settings**, set **Allow public client flows** to **Yes**.
5. Copy the **Application (client) ID** into `.env` as `MICROSOFT_CLIENT_ID`. Leave `MICROSOFT_TENANT_ID` as `consumers` for a personal account, or `common` if you want both personal and work/school accounts to work.

### 4. Resend (sends the digest email)

1. Sign up at [resend.com](https://resend.com) (free tier covers this easily).
2. Get an API key, put it in `.env` as `RESEND_API_KEY`.
3. Set `DIGEST_FROM_EMAIL` (a verified sender — Resend's onboarding walks you through domain/sender verification) and `DIGEST_TO_EMAIL` (your own address).

### 5. Get refresh tokens

```bash
npm install
cp .env.example .env   # fill in the values from steps 1-4 first
npm run auth:gmail     # prints a code + URL; authorize, then paste the refresh token into .env
npm run auth:outlook   # same, for Outlook
```

### 6. Run it

```bash
npm run digest
```

Check `DIGEST_TO_EMAIL` for the result. If nothing important came through, you'll still get a "nothing new" email so you know it ran.

### 7. See what was detected (Phase 2)

Each run also extracts **Detected Events** — meetings and appointments found in the mail
that passed Triage — and stores them Pending in a local SQLite database
([ADR-0005](./docs/adr/0005-sqlite-for-phase-2-persistence.md)). Nothing is written to a
calendar; that needs a Confirmation in the web app.

```bash
npm run events            # what is waiting for review
npm run events -- ignored # or confirmed
```

This is how to judge whether detection is good enough to build on: run it over real mail
for a while and read the list. A wrong event costs more than a missed one, so the prompt
is deliberately conservative — most emails should yield nothing.

The web UI that reviews and confirms these lives in [`web/`](./web/) and currently runs on
fixtures; wiring it to this database is the next step.

## Scheduling

[`.github/workflows/digest.yml`](./.github/workflows/digest.yml) runs this every 6 hours via GitHub Actions (not Vercel's own Cron Jobs — see the amendment in [ADR-0004](./docs/adr/0004-managed-cloud-paas-deployment.md) for why). To enable it:

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add every variable from `.env` as a repository secret (same names).
3. The workflow also runs on-demand from the **Actions** tab (`workflow_dispatch`) if you want to trigger it manually.

If you change how often it runs, update both the `cron` schedule and `LOOKBACK_HOURS` in the workflow file so they match — otherwise you'll either miss emails or get the same one summarized twice.

**The scheduled job does not detect events.** Its runner is discarded when the job ends,
so the database would not survive it, and detecting there would spend an LLM call per run
on results nobody can read — the workflow sets `DETECT_EVENTS=false` for that reason. Until
Phase 3 puts this on a host with real storage, run `npm run digest` on the machine that
keeps the database (a local cron or launchd job) if you want events collected.
