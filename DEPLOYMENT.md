# CampusEats — production deployment (Vercel + Supabase)

This guide covers hosting the Next.js app on **Vercel**, database/auth on **Supabase**, payments on **Razorpay**, and running SQL migrations.

---

## 1. Environment variables

Set these in **Vercel** → Project → Settings → Environment Variables (Production / Preview as needed).

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Project Settings → API → `service_role` key (**server only**, never expose to browser) |
| `RAZORPAY_KEY_ID` | Yes (wallet) | Razorpay Dashboard → Account & Settings → API Keys → Key Id |
| `RAZORPAY_KEY_SECRET` | Yes (wallet) | Same screen → Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes (webhooks) | Razorpay Dashboard → **Webhooks** → your endpoint → signing secret (create webhook first, see below) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Production site origin with no trailing slash, e.g. `https://your-app.vercel.app` — used for invite links and emails |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | Web Push: generate VAPID key pair; public key here |
| `VAPID_PRIVATE_KEY` | Optional | Web Push: private key (server only) |
| `VAPID_SUBJECT` | Optional | Web Push: contact, e.g. `mailto:ops@yourdomain.com` |
| `CAPACITOR_SERVER_URL` | Optional | Only if using Capacitor with a hosted shell |

**Local development:** copy the above into `.env.local` (never commit real secrets).

---

## 2. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. Note **Project URL** and **anon** + **service_role** keys (Settings → API).
3. Enable **Auth** → Email provider (and any policies you need).
4. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and link the project:

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

5. Apply migrations from this repo:

   ```bash
   supabase db push
   ```

   Or run SQL from `supabase/migrations/` in order in the SQL Editor if you prefer.

6. **Auth URL configuration:** add your Vercel production URL (and preview if used) under Authentication → URL configuration → **Site URL** / **Redirect URLs**.

7. **Storage:** if you use menu image uploads, ensure the bucket/policies from your migrations exist (see migration `009` if applicable).

---

## 3. Razorpay setup and webhooks

1. Create / log in to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Switch to **Live** mode when going to production; use **Test** keys on Preview/staging.
3. **API keys:** copy Key Id and Key Secret into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. **Webhook:**
   - Dashboard → **Webhooks** → Add New Webhook.
   - URL: `https://<YOUR_VERCEL_DOMAIN>/api/webhooks/razorpay`
   - Active events (minimum): **`payment.captured`**, **`refund.processed`**.
   - Save and copy the **Webhook secret** into `RAZORPAY_WEBHOOK_SECRET` on Vercel.

**Behaviour:**

- **`payment.captured`:** credits the student wallet for Razorpay orders created by `/api/wallet/create-order` (same idempotency as `/api/wallet/verify` via `credit_wallet_topup`).
- **`refund.processed`:** for payments whose notes include `purpose: wallet_topup`, debits the wallet and inserts a ledger row via `debit_wallet_razorpay_refund` (idempotent per Razorpay refund id).

The handler returns **200** immediately and processes the payload **asynchronously** (`after()`).

---

## 4. Vercel project setup

1. Import the Git repository into [Vercel](https://vercel.com).
2. Framework preset: **Next.js**; root directory: repo root (default).
3. Add all environment variables from section 1.
4. Deploy. `vercel.json` sets:
   - **`regions`:** `["bom1"]` (Mumbai).
   - **`maxDuration`:** 10 seconds for `src/app/api/**/route.ts` serverless functions.

**Runtime notes:**

- **`/api/tenant`** and **`/api/menu-items`** use **Edge** runtime where configured.
- **`/api/wallet/*`**, **`/api/admin/*`**, and **`/api/webhooks/razorpay`** use **Node.js** (Razorpay SDK, `crypto`, service logic).

---

## 5. Running database migrations

From the repo root with Supabase CLI linked:

```bash
supabase db push
```

To reset a **local** database only (destructive):

```bash
supabase db reset
```

Production changes should always go through reviewed migration files in `supabase/migrations/`.

---

## 6. Adding a new institution (tenant)

Super admins use the in-app flow (mirrors `AddInstitutionForm` → `POST /api/superadmin/institutions`).

1. Deploy the app and sign in as a user with role **`super_admin`** (seeded or created via Supabase SQL / Auth).
2. Open **`/admin/tenants`**.
3. Use **Add institution** (or equivalent UI).
4. Fill in:
   - **Institution name**
   - **Slug** (lowercase, hyphens; used in URLs and `/api/tenant?slug=…` for branding on login/register)
   - **Domain whitelist** — at least one email domain students may register with (e.g. `student.university.edu`)
   - **Primary color** (optional branding)
   - **Institution admin email** — receives the invite / onboarding path your API implements
   - Optional **logo** upload
5. Submit. The API creates the institution, stores branding, and triggers the configured invite flow.

**Follow-up (operations):**

- Institution admin completes signup and configures **canteens**, **owners**, and **staff** per your playbook.
- Students register at `/register` with institution slug + email matching the whitelist.

---

## 7. Smoke checks after deploy

- Open `/login` and `/register`; confirm tenant branding loads for `?slug=<your-slug>`.
- Place a small **wallet top-up** in test mode; confirm `/api/wallet/verify` and (if configured) webhook both behave (duplicate credit should not occur).
- Confirm **Realtime** updates on orders/notifications in the staff/student UIs after migration `014` publication changes.

---

## 8. Related files

| Area | Path |
|------|------|
| Vercel config | `vercel.json` |
| Razorpay webhook | `src/app/api/webhooks/razorpay/route.ts` |
| Wallet credit (shared) | `src/lib/wallet/apply-razorpay-wallet-topup.ts` |
| Production migration (indexes, Realtime, refund RPC) | `supabase/migrations/014_production_indexes_realtime_wallet_refund.sql` |
