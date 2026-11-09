# Mobile COD Electronics Store

Next.js (storefront + `/v1` API on Netlify) + Neon Postgres + Cloudinary + Gmail SMTP.

Ticket brief/plan: `siw-nickz-ai-common/tickets/NO-TICKET-2026-11-09-mobile-cod-electronic-store/`

## Layout

```
app/           Next.js App Router (UI + serverless `/v1` API)
migrations/    Postgres schema SQL (apply to Neon as needed)
docs/api.md    Stable /v1 contract
```

## Local setup

1. Copy root `.env.example` → `app/.env.local` and fill `DATABASE_URL`, `JWT_SECRET`, Cloudinary, SMTP.
   Keep `NEXT_PUBLIC_API_BASE_URL` empty so the browser calls same-origin `/v1`.
2. Ensure Neon schema exists (apply `migrations/001_init.up.sql` then `migrations/002_product_category.up.sql` if needed).
3. App (Node 20+):
   ```bash
   cd app
   npm install
   npm run dev
   ```
4. Bootstrap first admin:
   ```bash
   curl -s localhost:3000/v1/admin/bootstrap -H 'Content-Type: application/json' \
     -d '{"name":"Owner","email":"admin@example.com","password":"secret12","secret":"<JWT_SECRET>"}'
   ```
5. Open http://localhost:3000 — `/admin` for import/orders/banner.

## Import products

Admin → upload CSV matching the Freelancer sample columns. **Electronics (`Elektronik`) rows only** are imported. Each initial stock writes `product_stock_ledger` type `admin-add`.

## Deploy

- **App (UI + API):** Netlify, base directory `app`, `@netlify/plugin-nextjs`.
- Set Netlify env vars from `.env.example` (`DATABASE_URL`, `JWT_SECRET`, Cloudinary, SMTP).
- Leave `NEXT_PUBLIC_API_BASE_URL` empty (same-origin `/v1`).
- Set `APP_URL` to the Netlify site URL (needed for SSR).

## Order & stock rules

- Checkout → `pending` + stock deduct + ledger `purchase` (negative qty) in one DB transaction with row locks.
- Admin **complete** → status only.
- Admin **cancel** → restore stock + ledger `restore`.
- Order number: `ORD-YYYYMMDDXXXXX` (daily sequence).

## Custom domain later

Change Netlify DNS settings only — no code change (EXT-2).
