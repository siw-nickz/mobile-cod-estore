# Public API `/v1` (stable for storefront + future mobile)

Base URL: same origin as the Next.js app (Netlify), e.g. `https://<site>.netlify.app`.
Local: `http://localhost:3000`. Breaking changes require `/v2` or a deprecation notice.

API lives in Next.js route handlers under `app/src/app/v1` (and `app/src/lib/server`).

## Health
- `GET /healthz` → `{ "status": "ok" }`

## Auth
- `POST /v1/auth/register` `{ name, email, password }` → `{ token, user }` (no password field)
- `POST /v1/auth/login` `{ email, password }` → `{ token, user }`
- `POST /v1/admin/auth/login` `{ email, password }` → `{ token, admin }`
- `POST /v1/admin/bootstrap` `{ name, email, password, secret }` — `secret` must equal `JWT_SECRET` (first admin only)

Header for protected calls: `Authorization: Bearer <token>`

## Catalog (shopper)
- `GET /v1/home` → banner, categories, featured
- `GET /v1/categories`
- `GET /v1/brands`
- `GET /v1/products?q=&category_id=&brand_id=&min_price=&max_price=&sort=price_asc|price_desc|newest`
- `GET /v1/products/{id}`
- `GET /v1/contact`
- `GET /v1/banner`

## Orders
- `POST /v1/orders` guest or shopper token  
  Body: `{ customer_name, customer_phone, customer_address, note, lines:[{ product_id, qty }] }`  
  → order with `order_number` (`ORD-YYYYMMDDXXXXX`), `status: pending`  
  Errors: `409` insufficient stock with message
- `GET /v1/orders/{order_number}`

Statuses: `pending` | `complete` | `canceled`

## Admin (admin token)
- `GET /v1/admin/orders`
- `POST /v1/admin/orders/{id}/complete`
- `POST /v1/admin/orders/{id}/cancel` (restores stock + ledger `restore`)
- `PUT /v1/admin/banner`
- `GET /v1/admin/products`
- `POST /v1/admin/products` upsert by sku (writes `admin-add`/`admin-reduce` ledger on stock change)
- `PUT /v1/admin/products/{id}` JSON **or** multipart form (fields + optional `image` file)
  - If `image` is present: server creates a Cloudinary signed upload, uploads the file, stores only `secure_url` in `product.image_url`
- `POST /v1/admin/products/import` (alias `POST /v1/admin/products/upload`) multipart `file` CSV or Excel `.xlsx`
  - File is read in memory only (not saved on host disk)
  - Excel uses columns **A–Q** only; electronics/`Elektronik` rows only; initial stock → ledger `admin-add`
- `POST /v1/admin/upload/sign` → Cloudinary signed upload params (`cloud_name`, `api_key`, `timestamp`, `signature`, `folder`, `upload_url`) for direct browser upload
- `POST /v1/admin/upload` multipart `file` → signed Cloudinary upload → `{ url }` (Cloudinary URL only)
- `POST /v1/admin/categories` `{ name }`
- `POST /v1/admin/brands` `{ name }`

## Must not break without version bump
Product list/detail fields needed to buy; place-order request/response; order_number + status; auth token shape.
