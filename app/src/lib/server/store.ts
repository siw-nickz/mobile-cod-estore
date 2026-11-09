import type { PoolClient } from "pg";
import { query, withTx } from "./db";
import { type Banner, type Order, type OrderItem, type Product, withStockStatus } from "./types";

export class StoreError extends Error {
  code: "not_found" | "insufficient" | "conflict" | "invalid_status";
  constructor(code: StoreError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const productSelect = `
  SELECT p.id, p.sku, COALESCE(p.barcode,'') AS barcode, p.name,
    cats.category_id, cats.category_name, cats.category_ids,
    p.brand_id, b.name AS brand_name, COALESCE(p.variant,'') AS variant, COALESCE(p.description,'') AS description,
    p.buy_price::float8 AS buy_price, p.sell_price::float8 AS sell_price, COALESCE(p.margin_pct,0)::float8 AS margin_pct,
    p.stock, COALESCE(p.weight_g,0) AS weight_g, COALESCE(p.length_cm,0)::float8 AS length_cm,
    COALESCE(p.width_cm,0)::float8 AS width_cm, COALESCE(p.height_cm,0)::float8 AS height_cm,
    COALESCE(p.condition,'') AS condition, COALESCE(p.upload_status,'') AS upload_status,
    COALESCE(p.image_url,'') AS image_url, p.hidden
  FROM product p
  LEFT JOIN brand b ON b.id = p.brand_id
  LEFT JOIN LATERAL (
    SELECT
      (array_agg(pc.category_id ORDER BY pc.id))[1] AS category_id,
      (array_agg(c.name ORDER BY pc.id))[1] AS category_name,
      COALESCE(array_agg(pc.category_id ORDER BY pc.id), '{}') AS category_ids
    FROM product_category pc
    JOIN category c ON c.id = pc.category_id
    WHERE pc.product_id = p.id
  ) cats ON TRUE`;

function mapProduct(r: Record<string, unknown>): Product {
  const rawIds = r.category_ids;
  const categoryIds = Array.isArray(rawIds)
    ? rawIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];
  return withStockStatus({
    id: Number(r.id),
    sku: String(r.sku),
    barcode: String(r.barcode || ""),
    name: String(r.name),
    category_id: r.category_id == null ? null : Number(r.category_id),
    category_name: r.category_name ? String(r.category_name) : "",
    category_ids: categoryIds,
    brand_id: r.brand_id == null ? null : Number(r.brand_id),
    brand_name: r.brand_name ? String(r.brand_name) : "",
    variant: String(r.variant || ""),
    description: String(r.description || ""),
    buy_price: Number(r.buy_price),
    sell_price: Number(r.sell_price),
    margin_pct: Number(r.margin_pct || 0),
    stock: Number(r.stock),
    weight_g: Number(r.weight_g || 0),
    length_cm: Number(r.length_cm || 0),
    width_cm: Number(r.width_cm || 0),
    height_cm: Number(r.height_cm || 0),
    condition: String(r.condition || ""),
    upload_status: String(r.upload_status || ""),
    image_url: String(r.image_url || ""),
    hidden: Boolean(r.hidden),
  });
}

let productCategorySchemaReady: Promise<void> | null = null;

/** Create product_category, migrate legacy product.category_id, drop that column. */
export async function ensureProductCategorySchema() {
  if (!productCategorySchemaReady) {
    productCategorySchemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS product_category (
          id BIGSERIAL PRIMARY KEY,
          category_id BIGINT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
          product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
          UNIQUE (category_id, product_id)
        )`);
      await query(`CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category (product_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category (category_id)`);
      const { rows } = await query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'product' AND column_name = 'category_id'
        ) AS exists`);
      if (rows[0]?.exists) {
        await query(`
          INSERT INTO product_category (category_id, product_id)
          SELECT category_id, id FROM product WHERE category_id IS NOT NULL
          ON CONFLICT (category_id, product_id) DO NOTHING`);
        await query(`DROP INDEX IF EXISTS idx_product_category`);
        await query(`ALTER TABLE product DROP COLUMN category_id`);
      }
    })().catch((e) => {
      productCategorySchemaReady = null;
      throw e;
    });
  }
  await productCategorySchemaReady;
}

async function syncProductCategories(
  client: PoolClient,
  productId: number,
  categoryIds: number[]
) {
  const unique = [...new Set(categoryIds.filter((id) => Number.isFinite(id) && id > 0))];
  await client.query(`DELETE FROM product_category WHERE product_id = $1`, [productId]);
  for (const categoryId of unique) {
    await client.query(
      `INSERT INTO product_category (category_id, product_id) VALUES ($1, $2)
       ON CONFLICT (category_id, product_id) DO NOTHING`,
      [categoryId, productId]
    );
  }
}

function resolveCategoryIds(p: Product): number[] {
  if (Array.isArray(p.category_ids) && p.category_ids.length) {
    return p.category_ids.map(Number).filter((n) => n > 0);
  }
  if (p.category_id) return [Number(p.category_id)];
  return [];
}

export async function createUser(name: string, email: string, passwordHash: string) {
  try {
    const { rows } = await query(
      `INSERT INTO "user" (name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, name, email, COALESCE(phone,'') AS phone, COALESCE(address,'') AS address`,
      [name, email, passwordHash]
    );
    return rows[0];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("duplicate") || msg.includes("unique")) throw new StoreError("conflict", "conflict");
    throw e;
  }
}

export async function userByEmail(email: string) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, COALESCE(phone,'') AS phone, COALESCE(address,'') AS address
     FROM "user" WHERE email = $1`,
    [email]
  );
  if (!rows[0]) throw new StoreError("not_found", "not found");
  return rows[0];
}

export async function createAdmin(name: string, email: string, passwordHash: string) {
  try {
    const { rows } = await query(
      `INSERT INTO admin (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email`,
      [name, email, passwordHash]
    );
    return rows[0];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("duplicate") || msg.includes("unique")) throw new StoreError("conflict", "conflict");
    throw e;
  }
}

export async function adminByEmail(email: string) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash FROM admin WHERE email = $1`,
    [email]
  );
  if (!rows[0]) throw new StoreError("not_found", "not found");
  return rows[0];
}

export async function ensureCategory(name: string) {
  const { rows } = await query(
    `INSERT INTO category (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [name]
  );
  return rows[0] as { id: number; name: string };
}

export async function ensureBrand(name: string) {
  const { rows } = await query(
    `INSERT INTO brand (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [name]
  );
  return rows[0] as { id: number; name: string };
}

export async function listCategories() {
  await ensureProductCategorySchema();
  const { rows } = await query(`SELECT id, name FROM category ORDER BY name`);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function listBrands() {
  const { rows } = await query(`SELECT id, name FROM brand ORDER BY name`);
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export const MAX_BANNERS = 5;

export async function ensureBannerSchema() {
  await query(`ALTER TABLE banner ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
}

function mapBanner(r: Record<string, unknown>): Banner {
  return {
    id: Number(r.id),
    title: String(r.title || ""),
    subtitle: String(r.subtitle || ""),
    image_url: String(r.image_url || ""),
    link_url: String(r.link_url || ""),
  };
}

export async function listBanners(): Promise<Banner[]> {
  await ensureBannerSchema();
  const { rows } = await query(
    `SELECT id, title, subtitle, COALESCE(image_url,'') AS image_url, COALESCE(link_url,'') AS link_url
     FROM banner
     ORDER BY sort_order ASC, id ASC
     LIMIT ${MAX_BANNERS}`
  );
  return rows.map(mapBanner);
}

/** @deprecated single-banner helper — returns first banner or empty */
export async function getBanner(): Promise<Banner> {
  const list = await listBanners();
  return (
    list[0] || {
      id: 0,
      title: "",
      subtitle: "",
      image_url: "",
      link_url: "",
    }
  );
}

export async function createBanner(b: Partial<Banner>): Promise<Banner> {
  await ensureBannerSchema();
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS c FROM banner`);
  if (Number(countRows[0]?.c || 0) >= MAX_BANNERS) {
    throw new StoreError("conflict", `max ${MAX_BANNERS} banners`);
  }
  const { rows } = await query(
    `INSERT INTO banner (title, subtitle, image_url, link_url, sort_order, updated_at)
     VALUES ($1,$2,$3,$4, COALESCE((SELECT MAX(sort_order)+1 FROM banner), 0), NOW())
     RETURNING id, title, subtitle, COALESCE(image_url,'') AS image_url, COALESCE(link_url,'') AS link_url`,
    [b.title || "", b.subtitle || "", b.image_url || "", b.link_url || ""]
  );
  return mapBanner(rows[0]);
}

export async function updateBanner(id: number, b: Partial<Banner>): Promise<Banner> {
  await ensureBannerSchema();
  const { rows } = await query(
    `UPDATE banner SET
       title=COALESCE(NULLIF($2,''), title),
       subtitle=COALESCE(NULLIF($3,''), subtitle),
       image_url=COALESCE(NULLIF($4,''), image_url),
       link_url=COALESCE(NULLIF($5,''), link_url),
       updated_at=NOW()
     WHERE id=$1
     RETURNING id, title, subtitle, COALESCE(image_url,'') AS image_url, COALESCE(link_url,'') AS link_url`,
    [id, b.title || "", b.subtitle || "", b.image_url || "", b.link_url || ""]
  );
  if (!rows[0]) throw new StoreError("not_found", "banner not found");
  return mapBanner(rows[0]);
}

export async function deleteBanner(id: number): Promise<void> {
  const { rowCount } = await query(`DELETE FROM banner WHERE id = $1`, [id]);
  if (!rowCount) throw new StoreError("not_found", "banner not found");
}

export async function getSettings() {
  const { rows } = await query(
    `SELECT contact_address, contact_phone, whatsapp_url, map_embed_url FROM store_settings WHERE id = 1`
  );
  return rows[0];
}

export async function productById(id: number, includeHidden = false): Promise<Product> {
  await ensureProductCategorySchema();
  const q = productSelect + ` WHERE p.id = $1` + (includeHidden ? "" : ` AND p.hidden = FALSE`);
  const { rows } = await query(q, [id]);
  if (!rows[0]) throw new StoreError("not_found", "not found");
  return mapProduct(rows[0]);
}

export async function listProducts(f: {
  includeHidden?: boolean;
  category_id?: number;
  brand_id?: number;
  min_price?: number;
  max_price?: number;
  q?: string;
  sort?: string;
}): Promise<Product[]> {
  await ensureProductCategorySchema();
  const conds: string[] = [];
  const args: unknown[] = [];
  let n = 1;
  if (!f.includeHidden) conds.push("p.hidden = FALSE");
  if (f.category_id) {
    conds.push(
      `EXISTS (SELECT 1 FROM product_category pc WHERE pc.product_id = p.id AND pc.category_id = $${n++})`
    );
    args.push(f.category_id);
  }
  if (f.brand_id) {
    conds.push(`p.brand_id = $${n++}`);
    args.push(f.brand_id);
  }
  if (f.min_price != null) {
    conds.push(`p.sell_price >= $${n++}`);
    args.push(f.min_price);
  }
  if (f.max_price != null) {
    conds.push(`p.sell_price <= $${n++}`);
    args.push(f.max_price);
  }
  if (f.q) {
    conds.push(
      `(p.name ILIKE $${n} OR COALESCE(b.name,'') ILIKE $${n} OR COALESCE(p.variant,'') ILIKE $${n} OR p.sku ILIKE $${n})`
    );
    args.push(`%${f.q}%`);
    n++;
  }
  const where = conds.length ? ` WHERE ${conds.join(" AND ")}` : "";
  let order = " ORDER BY p.name ASC";
  if (f.sort === "price_asc") order = " ORDER BY p.sell_price ASC";
  if (f.sort === "price_desc") order = " ORDER BY p.sell_price DESC";
  if (f.sort === "newest") order = " ORDER BY p.created_at DESC";
  const { rows } = await query(productSelect + where + order, args);
  return rows.map(mapProduct);
}

export async function hideProduct(id: number, hidden: boolean): Promise<Product> {
  const existing = await productById(id, true);
  existing.hidden = hidden;
  return upsertProduct(existing, false);
}

export async function deleteProduct(id: number): Promise<void> {
  // Soft-delete: hide from catalog (orders may still reference the row).
  await hideProduct(id, true);
}

export async function upsertProduct(p: Product, writeInitialLedger: boolean): Promise<Product> {
  await ensureProductCategorySchema();
  const categoryIds = resolveCategoryIds(p);
  const id = await withTx(async (client) => {
    const existing = await client.query(`SELECT id, stock FROM product WHERE sku = $1`, [p.sku]);
    if (!existing.rows[0]) {
      const ins = await client.query(
        `INSERT INTO product (
          sku, barcode, name, brand_id, variant, description,
          buy_price, sell_price, margin_pct, stock, weight_g, length_cm, width_cm, height_cm,
          condition, upload_status, image_url, hidden
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id`,
        [
          p.sku,
          p.barcode || null,
          p.name,
          p.brand_id || null,
          p.variant || null,
          p.description || null,
          Number(p.buy_price) || 0,
          Number(p.sell_price) || 0,
          p.margin_pct || 0,
          Number(p.stock) || 0,
          p.weight_g || 0,
          p.length_cm || 0,
          p.width_cm || 0,
          p.height_cm || 0,
          p.condition || null,
          p.upload_status || null,
          p.image_url || null,
          Boolean(p.hidden),
        ]
      );
      const newId = Number(ins.rows[0].id);
      await syncProductCategories(client, newId, categoryIds);
      if (writeInitialLedger && (Number(p.stock) || 0) !== 0) {
        await client.query(
          `INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty) VALUES (NULL, $1, $2, $3)`,
          ["admin-add", newId, Number(p.stock) || 0]
        );
      }
      return newId;
    }
    const existingId = Number(existing.rows[0].id);
    const existingStock = Number(existing.rows[0].stock);
    const nextStock = Number(p.stock) || 0;
    const delta = nextStock - existingStock;
    await client.query(
      `UPDATE product SET
        barcode=$2, name=$3, brand_id=$4, variant=$5, description=$6,
        buy_price=$7, sell_price=$8, margin_pct=$9, stock=$10, weight_g=$11,
        length_cm=$12, width_cm=$13, height_cm=$14, condition=$15, upload_status=$16,
        image_url=$17, hidden=$18, updated_at=NOW()
       WHERE id=$1`,
      [
        existingId,
        p.barcode || null,
        p.name,
        p.brand_id || null,
        p.variant || null,
        p.description || null,
        Number(p.buy_price) || 0,
        Number(p.sell_price) || 0,
        p.margin_pct || 0,
        nextStock,
        p.weight_g || 0,
        p.length_cm || 0,
        p.width_cm || 0,
        p.height_cm || 0,
        p.condition || null,
        p.upload_status || null,
        p.image_url || null,
        Boolean(p.hidden),
      ]
    );
    await syncProductCategories(client, existingId, categoryIds);
    if (delta > 0) {
      await client.query(
        `INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty) VALUES (NULL, $1, $2, $3)`,
        ["admin-add", existingId, delta]
      );
    } else if (delta < 0) {
      await client.query(
        `INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty) VALUES (NULL, $1, $2, $3)`,
        ["admin-reduce", existingId, delta]
      );
    }
    return existingId;
  });
  return productById(id, true);
}

async function orderItems(client: PoolClient | null, orderId: number): Promise<OrderItem[]> {
  const sql = `SELECT id, order_id, product_id, qty, unit_price::float8 AS unit_price, product_name, product_sku
         FROM order_item WHERE order_id = $1`;
  const { rows } = await (client ? client.query(sql, [orderId]) : query(sql, [orderId]));
  return rows.map((r) => ({
    id: Number(r.id),
    order_id: Number(r.order_id),
    product_id: Number(r.product_id),
    qty: Number(r.qty),
    unit_price: Number(r.unit_price),
    product_name: String(r.product_name),
    product_sku: String(r.product_sku),
  }));
}

export async function placeOrder(input: {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note?: string;
  user_id?: number | null;
  lines: { product_id: number; qty: number }[];
}): Promise<Order> {
  if (!input.lines?.length) throw new Error("no lines");
  return withTx(async (client) => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10).replace(/-/g, "");
    const dayDate = now.toISOString().slice(0, 10);
    const seqRes = await client.query(
      `INSERT INTO order_daily_counter (day_key, last_seq)
       VALUES ($1::date, 1)
       ON CONFLICT (day_key) DO UPDATE SET last_seq = order_daily_counter.last_seq + 1
       RETURNING last_seq`,
      [dayDate]
    );
    const seq = Number(seqRes.rows[0].last_seq);
    const orderNumber = `ORD-${day}${String(seq).padStart(5, "0")}`;
    const ord = await client.query(
      `INSERT INTO "order" (order_number, status, user_id, customer_name, customer_phone, customer_address, note)
       VALUES ($1,'pending',$2,$3,$4,$5,$6)
       RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
      [
        orderNumber,
        input.user_id || null,
        input.customer_name,
        input.customer_phone,
        input.customer_address,
        input.note || "",
      ]
    );
    const out: Order = {
      id: Number(ord.rows[0].id),
      order_number: String(ord.rows[0].order_number),
      status: String(ord.rows[0].status),
      user_id: ord.rows[0].user_id == null ? null : Number(ord.rows[0].user_id),
      customer_name: String(ord.rows[0].customer_name),
      customer_phone: String(ord.rows[0].customer_phone),
      customer_address: String(ord.rows[0].customer_address),
      note: String(ord.rows[0].note || ""),
      items: [],
    };
    for (const line of input.lines) {
      if (line.qty <= 0) throw new Error("invalid qty");
      const prod = await client.query(
        `SELECT id, sku, name, sell_price::float8 AS sell_price, stock FROM product WHERE id = $1 FOR UPDATE`,
        [line.product_id]
      );
      if (!prod.rows[0]) throw new StoreError("not_found", "not found");
      const p = prod.rows[0];
      if (Number(p.stock) < line.qty) throw new StoreError("insufficient", "insufficient stock");
      await client.query(`UPDATE product SET stock = $2, updated_at = NOW() WHERE id = $1`, [
        p.id,
        Number(p.stock) - line.qty,
      ]);
      await client.query(
        `INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty) VALUES ($1,'purchase',$2,$3)`,
        [out.id, p.id, -line.qty]
      );
      const item = await client.query(
        `INSERT INTO order_item (order_id, product_id, qty, unit_price, product_name, product_sku)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, order_id, product_id, qty, unit_price::float8 AS unit_price, product_name, product_sku`,
        [out.id, p.id, line.qty, p.sell_price, p.name, p.sku]
      );
      out.items!.push({
        id: Number(item.rows[0].id),
        order_id: Number(item.rows[0].order_id),
        product_id: Number(item.rows[0].product_id),
        qty: Number(item.rows[0].qty),
        unit_price: Number(item.rows[0].unit_price),
        product_name: String(item.rows[0].product_name),
        product_sku: String(item.rows[0].product_sku),
      });
    }
    return out;
  });
}

export async function orderByNumber(number: string): Promise<Order> {
  const { rows } = await query(
    `SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
     FROM "order" WHERE order_number = $1`,
    [number]
  );
  if (!rows[0]) throw new StoreError("not_found", "not found");
  const o = rows[0];
  return {
    id: Number(o.id),
    order_number: String(o.order_number),
    status: String(o.status),
    user_id: o.user_id == null ? null : Number(o.user_id),
    customer_name: String(o.customer_name),
    customer_phone: String(o.customer_phone),
    customer_address: String(o.customer_address),
    note: String(o.note || ""),
    items: await orderItems(null, Number(o.id)),
  };
}

export async function listOrders(): Promise<Order[]> {
  const { rows } = await query(
    `SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
     FROM "order" ORDER BY created_at DESC`
  );
  return rows.map((o) => ({
    id: Number(o.id),
    order_number: String(o.order_number),
    status: String(o.status),
    user_id: o.user_id == null ? null : Number(o.user_id),
    customer_name: String(o.customer_name),
    customer_phone: String(o.customer_phone),
    customer_address: String(o.customer_address),
    note: String(o.note || ""),
  }));
}

export async function completeOrder(id: number): Promise<Order> {
  const { rows } = await query(
    `UPDATE "order" SET status = 'complete', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
    [id]
  );
  if (!rows[0]) throw new StoreError("invalid_status", "invalid status");
  const o = rows[0];
  return {
    id: Number(o.id),
    order_number: String(o.order_number),
    status: String(o.status),
    user_id: o.user_id == null ? null : Number(o.user_id),
    customer_name: String(o.customer_name),
    customer_phone: String(o.customer_phone),
    customer_address: String(o.customer_address),
    note: String(o.note || ""),
  };
}

export async function cancelOrder(id: number): Promise<Order> {
  return withTx(async (client) => {
    const ord = await client.query(
      `SELECT id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at
       FROM "order" WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!ord.rows[0]) throw new StoreError("not_found", "not found");
    if (ord.rows[0].status !== "pending") throw new StoreError("invalid_status", "invalid status");
    const lines = await client.query(`SELECT product_id, qty FROM order_item WHERE order_id = $1`, [id]);
    for (const l of lines.rows) {
      await client.query(`UPDATE product SET stock = stock + $2, updated_at = NOW() WHERE id = $1`, [
        l.product_id,
        l.qty,
      ]);
      await client.query(
        `INSERT INTO product_stock_ledger (transaction_id, type, product_id, qty) VALUES ($1,'restore',$2,$3)`,
        [id, l.product_id, l.qty]
      );
    }
    const updated = await client.query(
      `UPDATE "order" SET status = 'canceled', updated_at = NOW()
       WHERE id = $1
       RETURNING id, order_number, status, user_id, customer_name, customer_phone, customer_address, note, created_at, updated_at`,
      [id]
    );
    const o = updated.rows[0];
    return {
      id: Number(o.id),
      order_number: String(o.order_number),
      status: String(o.status),
      user_id: o.user_id == null ? null : Number(o.user_id),
      customer_name: String(o.customer_name),
      customer_phone: String(o.customer_phone),
      customer_address: String(o.customer_address),
      note: String(o.note || ""),
      items: await orderItems(client, id),
    };
  });
}
