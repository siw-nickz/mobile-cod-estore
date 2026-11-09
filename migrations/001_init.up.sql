CREATE TABLE IF NOT EXISTS category (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product (
    id              BIGSERIAL PRIMARY KEY,
    sku             TEXT NOT NULL UNIQUE,
    barcode         TEXT,
    name            TEXT NOT NULL,
    brand_id        BIGINT REFERENCES brand(id),
    variant         TEXT,
    description     TEXT,
    buy_price       NUMERIC(14,2) NOT NULL DEFAULT 0,
    sell_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
    margin_pct      NUMERIC(8,2),
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    weight_g        INTEGER,
    length_cm       NUMERIC(10,2),
    width_cm        NUMERIC(10,2),
    height_cm       NUMERIC(10,2),
    condition       TEXT,
    upload_status   TEXT,
    image_url       TEXT,
    hidden          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_category (
    id           BIGSERIAL PRIMARY KEY,
    category_id  BIGINT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    product_id   BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    UNIQUE (category_id, product_id)
);

CREATE TABLE IF NOT EXISTS banner (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    subtitle    TEXT NOT NULL DEFAULT '',
    image_url   TEXT NOT NULL DEFAULT '',
    link_url    TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO banner (id, title, subtitle, image_url)
VALUES (1, 'Mobile COD Electronics', 'Cash on delivery — phone-first shopping', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "user" (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    phone           TEXT,
    address         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "order" (
    id              BIGSERIAL PRIMARY KEY,
    order_number    TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'canceled')),
    user_id         BIGINT REFERENCES "user"(id),
    customer_name   TEXT NOT NULL,
    customer_phone  TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES "order"(id),
    product_id      BIGINT NOT NULL REFERENCES product(id),
    qty             INTEGER NOT NULL CHECK (qty > 0),
    unit_price      NUMERIC(14,2) NOT NULL,
    product_name    TEXT NOT NULL,
    product_sku     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_stock_ledger (
    id              BIGSERIAL PRIMARY KEY,
    transaction_id  BIGINT REFERENCES "order"(id),
    type            TEXT NOT NULL CHECK (type IN ('purchase', 'admin-add', 'admin-reduce', 'restore')),
    product_id      BIGINT NOT NULL REFERENCES product(id),
    qty             INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_daily_counter (
    day_key     DATE PRIMARY KEY,
    last_seq    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS store_settings (
    id              BIGSERIAL PRIMARY KEY,
    contact_address TEXT NOT NULL DEFAULT '',
    contact_phone   TEXT NOT NULL DEFAULT '',
    whatsapp_url    TEXT NOT NULL DEFAULT '',
    map_embed_url   TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (id, contact_address, contact_phone, whatsapp_url, map_embed_url)
VALUES (1, 'Palo, Philippines', '', 'https://wa.me/', '')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_product_name ON product (name);
CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category (product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category (category_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON "order" (status);
CREATE INDEX IF NOT EXISTS idx_ledger_product ON product_stock_ledger (product_id);
