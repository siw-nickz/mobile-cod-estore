# Mobile COD Electronics Store

Go API (Render) + Next.js storefront (Netlify) + Neon Postgres + Cloudinary + Gmail SMTP.

Ticket brief/plan: `siw-nickz-ai-common/tickets/NO-TICKET-2026-11-09-mobile-cod-electronic-store/`

## Layout

```
backend/     Go API (:8080)
frontend/    Next.js (App Router + Tailwind)
docs/api.md  Stable /v1 contract
```

## Local setup

1. Copy `.env.example` → `backend/.env` and fill `DATABASE_URL` (Neon), `JWT_SECRET`.
2. Backend:
   ```bash
   cd backend
   go run ./cmd/api
   ```
   Migrations run on startup.
3. Bootstrap first admin:
   ```bash
   curl -s localhost:8080/v1/admin/bootstrap -H 'Content-Type: application/json' \
     -d '{"name":"Owner","email":"admin@example.com","password":"secret12","secret":"<JWT_SECRET>"}'
   ```
4. Frontend (requires Node 20+):
   ```bash
   cd frontend
   cp ../.env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL
   npm install
   npm run dev
   ```
5. Open http://localhost:3000 — `/admin` for import/orders/banner.

## Import products

Admin → upload CSV matching the Freelancer sample columns. **Electronics (`Elektronik`) rows only** are imported. Each initial stock writes `product_stock_ledger` type `admin-add`.

## Deploy

See `../siw-nickz-ai-common/tickets/NO-TICKET-2026-11-09-mobile-cod-electronic-store/out/deploy-steps.md` (or `out/deploy-steps.md` under the ticket once written).

- **API:** Render Web Service, root `backend`, start `go run ./cmd/api` or build binary.
- **Web:** Netlify, base `frontend`, build `npm run build`, publish `.next` / Next runtime.
- Set `CORS_ORIGIN` to the Netlify URL; `NEXT_PUBLIC_API_BASE_URL` to the Render URL.

## Order & stock rules

- Checkout → `pending` + stock deduct + ledger `purchase` (negative qty) in one DB transaction with row locks.
- Admin **complete** → status only.
- Admin **cancel** → restore stock + ledger `restore`.
- Order number: `ORD-YYYYMMDDXXXXX` (daily sequence).

## Custom domain later

Change Netlify / Render DNS settings only — no code change (EXT-2).
