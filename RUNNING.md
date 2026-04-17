# How to run CampusEats (full stack)

This document explains how to run the **Next.js web app**, wire **Supabase** (database, auth, storage, realtime), optional **Razorpay** (wallet), optional **web push**, and optional **Capacitor** (Android / iOS shells). Production hosting is summarized in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. What you are running

| Layer | Technology | Notes |
|--------|------------|--------|
| App | Next.js 15 (App Router), React 19 | Dev uses Turbopack (`npm run dev`). |
| Backend in same repo | `src/app/api/**/route.ts` | Some routes use Edge where configured; wallet / admin / webhooks use Node. |
| Data & auth | Supabase (Postgres + Auth + Storage + Realtime) | Migrations live in `supabase/migrations/`. |
| Payments | Razorpay | Optional for browsing; required for wallet top-up and webhook-driven credits. |
| Mobile shell | Capacitor 7 | Static `out/` export conflicts with API routes; production-style mobile usually uses `CAPACITOR_SERVER_URL` pointing at a deployed Next app. |

---

## 2. Prerequisites

- **Node.js 20** (matches CI; LTS recommended).
- **npm** (repo has `package-lock.json` — use `npm ci` for reproducible installs).
- A **Supabase** project (free tier is fine for local development).
- Optional: **Supabase CLI** for `supabase link` and `supabase db push`.
- Optional: **Razorpay** test account for wallet flows.
- Optional: **Android Studio** (Android), **Xcode** (iOS, macOS only) for native Capacitor runs.

---

## 3. Install the web app

From the repository root:

```bash
npm ci
```

For day-to-day development after the first install, `npm install` is fine.

---

## 4. Environment variables (local)

Create **`.env.local`** in the repo root (this file is gitignored). Never commit secrets.

### 4.1 Minimum to boot the UI and auth

These are **required** for middleware and Supabase clients to work:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` `public` key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server only**; used by admin APIs (registration fallback, superadmin, wallet credit paths, etc.). |

If any of the three are missing, protected routes and many APIs will fail at runtime.

### 4.2 Strongly recommended for correct links

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Site origin **without** trailing slash, e.g. `http://localhost:3000`. Used for invite links, bulk import base URL, staff display links, etc. Defaults in some code paths may fall back to `http://localhost:3000`, but set this explicitly to avoid surprises. |

### 4.3 Wallet and payments (optional until you test wallet)

| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Razorpay key id (test or live). |
| `RAZORPAY_KEY_SECRET` | Razorpay secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Signing secret from Razorpay **Webhooks** (needed for `/api/webhooks/razorpay` verification). |

### 4.4 Web push (optional)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key in the browser. |
| `VAPID_PRIVATE_KEY` | VAPID private key (server). |
| `VAPID_SUBJECT` | Contact string, e.g. `mailto:you@example.com`. |

### 4.5 Capacitor / mobile (optional)

| Variable | Purpose |
|----------|---------|
| `CAPACITOR_SERVER_URL` | When set, `capacitor.config.ts` sets `server.url` so the native app loads your **hosted** Next deployment (keeps API routes working). Example: `https://your-app.vercel.app`. |
| `CAPACITOR_STATIC_EXPORT` | Set to `1` only when intentionally building a static export (`next.config.ts` switches to `output: "export"`). See section 9. |

**Example skeleton** (replace placeholders):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_SITE_URL=http://localhost:3000

# RAZORPAY_KEY_ID=rzp_test_...
# RAZORPAY_KEY_SECRET=...
# RAZORPAY_WEBHOOK_SECRET=...
```

Restart `npm run dev` after any change to `.env.local`.

---

## 5. Supabase: database and auth

### 5.1 Create a project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Settings → API**, copy **Project URL**, **anon public** key, and **service_role** key into `.env.local`.

### 5.2 Apply migrations

This repo ships SQL migrations under `supabase/migrations/`. Apply them **in filename order** on your database.

**Option A — Supabase CLI (recommended)**

```bash
# Install CLI: https://supabase.com/docs/guides/cli
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B — SQL Editor**

Run each file in order in the Supabase SQL editor (or any Postgres client):

`001` → `002` → … → `014` (see filenames in `supabase/migrations/`).

### 5.3 Auth URL configuration (critical for local login)

In Supabase Dashboard → **Authentication** → **URL configuration**:

- Set **Site URL** to `http://localhost:3000` (or your dev URL).
- Add **Redirect URLs** for the same origin (and any preview URLs you use).

If redirects are wrong, magic links and OAuth-style redirects can fail.

### 5.4 Email confirmation (developer quality of life)

For local testing, many teams temporarily **disable “Confirm email”** for the Email provider (Authentication → Providers → Email), so `signUp` returns a session immediately and the student profile upsert in the register flow succeeds without opening the inbox. Re-enable confirmation before production.

### 5.5 Optional demo data (menu, canteen, slots)

After migrations succeed, you can load demo content with:

`supabase/seed/001_seed.sql`

Run it once in the SQL editor (as a privileged role / service context). It creates:

- Institution slug **`demo-college`**
- Domain whitelist including **`demo.edu`**
- A canteen, categories, menu items, and lunch **time slots**

Students can then register with an email like `you@demo.edu` and institution code **`demo-college`**.

### 5.6 Storage bucket

Migration `009` defines the **`menu-images`** storage bucket used for menu photos. No extra manual step if that migration ran successfully.

### 5.7 Other roles (staff, owner, institution admin, super admin)

- **Student**: use `/register` with a whitelisted email domain after seed (or your own institution row + whitelist).
- **Staff / owner / institution_admin / super_admin**: not created by the public register form alone. Typical approaches:
  - Use in-app superadmin / institution flows once you have a first `super_admin` profile, or
  - Insert or update `profiles` (and related rows) carefully via SQL / Supabase dashboard, matching your RLS and business rules.

See [DEPLOYMENT.md](DEPLOYMENT.md) §6 for adding a tenant via superadmin in a deployed environment.

---

## 6. Run the Next.js app (development)

```bash
npm run dev
```

Default URL: **http://localhost:3000** (Next.js default port).

**Useful routes to verify:**

- `/login`, `/register?slug=demo-college` (after seed)
- Protected areas: `/student`, `/staff`, `/owner`, `/admin` (require auth + profile role)

---

## 7. Production-like local run (no Turbopack dev server)

```bash
npm run build
npm run start
```

`npm run build` uses Turbopack for the production build (see `package.json`). Use this to catch build-only issues before deploy.

---

## 8. Lint

```bash
npm run lint
```

There is no `npm test` script in this repo at time of writing; validation is lint + manual flows + optional CI.

---

## 9. Capacitor and mobile shells

### 9.1 Design constraint

With `CAPACITOR_STATIC_EXPORT=1`, Next is configured for **`output: "export"`**, which does **not** support App Router **Route Handlers** under `src/app/api/**`. So a “full” app with APIs cannot be shipped as a pure static `out/` bundle without architectural changes.

**Practical setups:**

1. **Hosted web + native shell (recommended for real features)**  
   - Deploy Next (e.g. Vercel).  
   - Set `CAPACITOR_SERVER_URL` to that HTTPS origin.  
   - Run `npx cap sync` / open native projects so the WebView loads the remote URL. APIs stay on the server.

2. **Static export (limited)**  
   - Only if you accept no API routes in the bundle or you maintain a separate API host and CORS story.  
   - `npm run build:mobile` runs static export + `cap sync` (see `package.json`).

### 9.2 Sync native projects

```bash
npx cap sync android
# and/or
npx cap sync ios
```

Open **`android/`** in Android Studio or **`ios/`** in Xcode to run on a device or emulator. iOS requires macOS.

---

## 10. Razorpay (local and webhooks)

1. Use **Test mode** keys in `.env.local` for development.
2. Wallet flows hit APIs such as `/api/wallet/create-order` and `/api/wallet/verify`.
3. **Webhooks**: Razorpay must reach a **public** HTTPS URL. For local dev, use a tunnel (e.g. ngrok, Cloudflare Tunnel) pointing at your machine, register `https://<tunnel>/api/webhooks/razorpay`, and set `RAZORPAY_WEBHOOK_SECRET`.  
   Event expectations are documented in [DEPLOYMENT.md](DEPLOYMENT.md) §3.

---

## 11. PWA icons (optional)

```bash
npm run generate:pwa-icons
```

Use when you change branding assets used by the icon script (see `scripts/generate-pwa-icons.mjs`).

---

## 12. Troubleshooting (quick)

| Symptom | Things to check |
|---------|------------------|
| Middleware / pages crash on startup | `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` set and server restarted. |
| Redirect loop or no session | Supabase **Site URL** and **Redirect URLs** include your dev origin. |
| Register succeeds but no profile / stuck | Email confirmation: user may have no session until confirm; use `/api/auth/register-profile` path or disable confirm for dev. |
| Wallet errors | `RAZORPAY_*` vars; use test keys; check server logs for API errors. |
| `npm run build:mobile` / export fails | Expected if you rely on `src/app/api` — use hosted `CAPACITOR_SERVER_URL` or refactor APIs. |
| Realtime / notifications odd | Migrations through `014` include publication/index changes; ensure `db push` completed. |

---

## 13. Where to go next

- **Production**: [DEPLOYMENT.md](DEPLOYMENT.md)  
- **Product scope**: [canteen_prd.md](canteen_prd.md)  
- **Implementation tasks**: [canteen_agent_tasks.md](canteen_agent_tasks.md)
