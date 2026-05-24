---
project: osce-triager
platform: Cloudflare Workers
adapter: "@opennextjs/cloudflare"
created_at: 2026-05-21
status: approved
---

# First Deployment Plan — OSCE Triager

Source of truth: `context/foundation/infrastructure.md` + `context/foundation/tech-stack.md`.

## Prerequisites

### A — Cloudflare CLI (Wrangler)

1. ✅ **Create a Cloudflare account** at cloudflare.com (free plan is sufficient to start).

2. ✅ **Install Wrangler globally** (optional — the plan uses `npx wrangler` throughout, so a
   local dev-dependency install in Step 1 is enough; global install is convenient for
   interactive commands):
   ```bash
   npm install -g wrangler
   ```

3. ✅ **Log in**:
   ```bash
   npx wrangler login
   ```
   Opens a browser OAuth flow. On success, credentials are stored in
   `~/.config/.wrangler/config/default.toml` — no token to copy manually.

4. ✅ **Verify**:
   ```bash
   npx wrangler whoami
   ```
   Should print your Cloudflare email and Account ID. Copy the Account ID — it is needed
   when Cloudflare Workers Builds asks for it in Step 7.

5. **Upgrade to Workers Paid if needed** (likely for this stack):
   Dashboard → Workers & Pages → Overview → click the "Upgrade" banner → Workers Paid ($5/mo).
   Do this before the first deploy if you expect the bundle to exceed 3 MiB (Next.js +
   Auth.js + Supabase-js typically does).

---

### B — Supabase project

1. ✅ **Create a Supabase account** at supabase.com (free plan covers MVP scale).

2. ✅ **Create a new project**:
   - Dashboard → New project
   - Name: `osce-triager`
   - Region: **West EU (Frankfurt)** — closest to Polish users, minimises Cloudflare → Supabase
     latency
   - Set a strong database password and save it somewhere safe (used as part of `DATABASE_URL`)

3. **Collect the required values** (Dashboard → Project Settings → API):

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API keys → `anon public` |
   | `DATABASE_URL` | Settings → Database → Connection string → **URI** (use the pooler URI on port 6543 for serverless/edge) |

4. **Enable Row Level Security** on every table before going live. Supabase creates tables
   with RLS disabled by default — leaving it off exposes all rows to the anon key.

5. **Supabase CLI** (needed for local development and migrations — install once):
   ```bash
   npm install -g supabase
   supabase login          # browser OAuth, same flow as wrangler login
   supabase link --project-ref <ref-id>   # ref-id from Dashboard → Settings → General
   ```

---

### C — Other one-time steps

- Generate `AUTH_SECRET`:
  ```bash
  openssl rand -hex 32
  ```
  Store the output — it goes into Cloudflare as a runtime secret in Step 5.

- ✅ Confirm the repo has a `master` branch and the remote is pushed:
  ```bash
  git checkout -b master   # if not already on master
  git push -u origin master
  ```

---

## Step 1 — Install OpenNext adapter and Wrangler

```bash
npm install --save-dev @opennextjs/cloudflare wrangler
```

Replaces the deprecated `@cloudflare/next-on-pages` that was listed in an earlier
tech-stack draft.

---

## Step 2 — Initialise OpenNext config

```bash
npx opennextjs-cloudflare
```

Writes `wrangler.toml` and `open-next.config.ts`. Then patch `wrangler.toml`:

```toml
name = "osce-triager"
compatibility_date = "2026-05-21"
compatibility_flags = ["nodejs_compat"]

[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "<anon-key>"
AUTH_URL = "https://osce-triager.workers.dev"
AUTH_TRUST_HOST = "true"
```

> Fill real Supabase values before committing.
> `AUTH_URL` and `AUTH_TRUST_HOST` are required — Workers runtime does not expose the
> request URL automatically the way Node.js does.

---

## Step 3 — Update package.json scripts

```json
"build:worker": "opennextjs-cloudflare build",
"deploy": "opennextjs-cloudflare build && wrangler deploy"
```

---

## Step 4 — Create Cloudflare project and log in (manual gate)

```bash
npx wrangler login
npx wrangler pages project create osce-triager
```

---

## Step 5 — Set runtime secrets

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put DATABASE_URL
```

Secrets are runtime-only and never stored in source control.
`NEXT_PUBLIC_*` vars go in `wrangler.toml [vars]` (build-time), not as secrets.

---

## Step 6 — First manual deploy and smoke test

```bash
npm run deploy
npx wrangler tail
```

Verify:
- `https://osce-triager.workers.dev` returns HTTP 200
- No uncaught exceptions in `wrangler tail`
- Home route renders without JS console errors

If bundle exceeds 3 MiB free tier limit, upgrade to Workers Paid ($5/mo) in the
Cloudflare Dashboard before re-deploying.

---

## Step 7 — Connect GitHub for auto-deploy (manual gate — Cloudflare Dashboard)

Cloudflare Workers Builds handles CI natively; no GitHub Actions required.

1. Dashboard → Workers & Pages → `osce-triager` → Settings → Builds & Deployments
2. Connect GitHub repository, set:
   - Production branch: `master`
   - Build command: `npm run build:worker`
   - Build output: `.worker-next`
3. Add build-time env vars in the Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AUTH_URL`
   - `AUTH_TRUST_HOST`

Every merge to `master` now triggers automatic build + deploy.
Preview builds are created per branch/PR automatically.

---

## Step 8 — Verify auto-deploy

Merge a trivial change to `master`. Confirm the Cloudflare Workers Builds run
completes and the production URL reflects the change.

---

## Manual deployments (at any time)

```bash
npm run deploy
```

---

## Rollback

```bash
npx wrangler rollback              # rolls back to previous deployment (<1 min)
npx wrangler versions list         # to pick a specific version
npx wrangler versions deploy <id>:100%
```

> Rollback reverts code only. Database migrations in Supabase are independent.

---

## Risks carried from infrastructure.md

| Risk | Mitigation |
|---|---|
| Bundle > 3 MiB on free tier | Upgrade to Workers Paid ($5/mo) from day one if needed |
| AUTH_URL not set | Steps 2 and 5 above address this explicitly |
| `NEXT_PUBLIC_*` not available at runtime | Placed in `wrangler.toml [vars]` (build-time) |
| OpenNext vs Next.js 16 gaps | Review OpenNext changelog before any Next.js upgrade |
| Preview URLs are public | Accept for MVP scope; configure Cloudflare Access later |

---

## Files produced by execution

| File | Description |
|---|---|
| `wrangler.toml` | Cloudflare Workers config |
| `open-next.config.ts` | OpenNext adapter config |
| `package.json` | Updated with `build:worker` + `deploy` scripts |
