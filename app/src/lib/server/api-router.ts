import bcrypt from "bcryptjs";
import { authFromRequest, issueToken, requireAdmin, ROLE_ADMIN, ROLE_SHOPPER } from "./auth";
import { presign, uploadImage } from "./cloudinary";
import { parseElectronicsCSV, parseElectronicsExcel } from "./import-products";
import { err, internal, json, logErr } from "./http";
import { notifyNewOrder } from "./mail";
import * as store from "./store";
import { StoreError } from "./store";
import type { Product } from "./types";

function pathOf(req: Request) {
  return new URL(req.url).pathname.replace(/\/+$/, "") || "/";
}

function storeFail(e: unknown) {
  if (e instanceof StoreError) {
    if (e.code === "not_found") return err(404, "not found");
    if (e.code === "insufficient") return err(409, "not enough stock for one or more items");
    if (e.code === "conflict") return err(409, "conflict");
    if (e.code === "invalid_status") return err(409, "order not pending");
  }
  return internal(e);
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function handleApi(req: Request): Promise<Response> {
  const method = req.method.toUpperCase();
  const path = pathOf(req);
  const url = new URL(req.url);

  try {
    if (method === "GET" && path === "/healthz") return json({ status: "ok" });

    if (method === "POST" && path === "/v1/auth/register") {
      const body = await readJson<{ name?: string; email?: string; password?: string }>(req);
      if (!body) return err(400, "invalid json");
      const name = (body.name || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      if (!name || !email || password.length < 6) return err(400, "name, email, password (min 6) required");
      const hash = await bcrypt.hash(password, 10);
      try {
        const user = await store.createUser(name, email, hash);
        const token = await issueToken(Number(user.id), ROLE_SHOPPER);
        return json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address } }, 201);
      } catch (e) {
        if (e instanceof StoreError && e.code === "conflict") return err(409, "email already registered");
        return storeFail(e);
      }
    }

    if (method === "POST" && path === "/v1/auth/login") {
      const body = await readJson<{ email?: string; password?: string }>(req);
      if (!body) return err(400, "invalid json");
      try {
        const user = await store.userByEmail((body.email || "").trim().toLowerCase());
        if (!(await bcrypt.compare(body.password || "", String(user.password_hash)))) {
          return err(401, "invalid credentials");
        }
        const token = await issueToken(Number(user.id), ROLE_SHOPPER);
        return json({
          token,
          user: { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address },
        });
      } catch (e) {
        if (e instanceof StoreError && e.code === "not_found") return err(401, "invalid credentials");
        return storeFail(e);
      }
    }

    if (method === "POST" && path === "/v1/admin/auth/login") {
      const body = await readJson<{ email?: string; password?: string }>(req);
      if (!body) return err(400, "invalid json");
      try {
        const admin = await store.adminByEmail((body.email || "").trim().toLowerCase());
        if (!(await bcrypt.compare(body.password || "", String(admin.password_hash)))) {
          return err(401, "invalid credentials");
        }
        const token = await issueToken(Number(admin.id), ROLE_ADMIN);
        return json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
      } catch (e) {
        if (e instanceof StoreError && e.code === "not_found") return err(401, "invalid credentials");
        return storeFail(e);
      }
    }

    if (method === "POST" && path === "/v1/admin/bootstrap") {
      const body = await readJson<{ name?: string; email?: string; password?: string; secret?: string }>(req);
      if (!body) return err(400, "invalid json");
      if (!body.secret || body.secret !== (process.env.JWT_SECRET || "dev-change-me")) {
        return err(401, "invalid bootstrap secret");
      }
      const hash = await bcrypt.hash(body.password || "", 10);
      try {
        const admin = await store.createAdmin(
          (body.name || "").trim(),
          (body.email || "").trim().toLowerCase(),
          hash
        );
        return json({ admin }, 201);
      } catch (e) {
        if (e instanceof StoreError && e.code === "conflict") return err(409, "admin exists");
        return storeFail(e);
      }
    }

    if (method === "GET" && path === "/v1/home") {
      const [banners, categories, products] = await Promise.all([
        store.listBanners(),
        store.listCategories(),
        store.listProducts({ sort: "newest" }),
      ]);
      return json({
        banners,
        banner: banners[0] || { id: 0, title: "", subtitle: "", image_url: "", link_url: "" },
        categories,
        products,
        featured: products.slice(0, 8),
      });
    }
    if (method === "GET" && path === "/v1/categories") return json(await store.listCategories());
    if (method === "GET" && path === "/v1/brands") return json(await store.listBrands());
    if (method === "GET" && path === "/v1/contact") return json(await store.getSettings());
    if (method === "GET" && path === "/v1/banner") return json(await store.listBanners());

    if (method === "GET" && path === "/v1/products") {
      const products = await store.listProducts({
        q: url.searchParams.get("q") || undefined,
        category_id: url.searchParams.get("category_id")
          ? Number(url.searchParams.get("category_id"))
          : undefined,
        brand_id: url.searchParams.get("brand_id") ? Number(url.searchParams.get("brand_id")) : undefined,
        min_price: url.searchParams.get("min_price") ? Number(url.searchParams.get("min_price")) : undefined,
        max_price: url.searchParams.get("max_price") ? Number(url.searchParams.get("max_price")) : undefined,
        sort: url.searchParams.get("sort") || undefined,
      });
      return json(products);
    }

    const productMatch = path.match(/^\/v1\/products\/(\d+)$/);
    if (method === "GET" && productMatch) {
      try {
        return json(await store.productById(Number(productMatch[1]), false));
      } catch (e) {
        if (e instanceof StoreError && e.code === "not_found") return err(404, "product not found");
        return storeFail(e);
      }
    }

    if (method === "POST" && path === "/v1/orders") {
      const body = await readJson<{
        customer_name?: string;
        customer_phone?: string;
        customer_address?: string;
        note?: string;
        lines?: { product_id: number; qty: number }[];
      }>(req);
      if (!body) return err(400, "invalid json");
      const customer_name = (body.customer_name || "").trim();
      const customer_phone = (body.customer_phone || "").trim();
      const customer_address = (body.customer_address || "").trim();
      if (!customer_name || !customer_phone || !customer_address || !body.lines?.length) {
        return err(400, "name, phone, address, and lines required");
      }
      const claims = await authFromRequest(req);
      try {
        const order = await store.placeOrder({
          customer_name,
          customer_phone,
          customer_address,
          note: body.note || "",
          user_id: claims?.role === ROLE_SHOPPER ? claims.uid : null,
          lines: body.lines,
        });
        void notifyNewOrder(order);
        return json(order, 201);
      } catch (e) {
        return storeFail(e);
      }
    }

    const orderMatch = path.match(/^\/v1\/orders\/([^/]+)$/);
    if (method === "GET" && orderMatch) {
      try {
        return json(await store.orderByNumber(decodeURIComponent(orderMatch[1])));
      } catch (e) {
        if (e instanceof StoreError && e.code === "not_found") return err(404, "order not found");
        return storeFail(e);
      }
    }

    // Admin routes
    const adminGate = async () => requireAdmin(req);

    if (method === "GET" && path === "/v1/admin/orders") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      return json(await store.listOrders());
    }

    const completeMatch = path.match(/^\/v1\/admin\/orders\/(\d+)\/complete$/);
    if (method === "POST" && completeMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      try {
        return json(await store.completeOrder(Number(completeMatch[1])));
      } catch (e) {
        return storeFail(e);
      }
    }

    const cancelMatch = path.match(/^\/v1\/admin\/orders\/(\d+)\/cancel$/);
    if (method === "POST" && cancelMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      try {
        return json(await store.cancelOrder(Number(cancelMatch[1])));
      } catch (e) {
        return storeFail(e);
      }
    }

    if (method === "GET" && path === "/v1/admin/banners") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      return json(await store.listBanners());
    }

    if (method === "POST" && path === "/v1/admin/banners") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const ct = req.headers.get("content-type") || "";
      let payload: { title?: string; subtitle?: string; image_url?: string; link_url?: string } = {};
      if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        payload = {
          title: String(form.get("title") || ""),
          subtitle: String(form.get("subtitle") || ""),
          link_url: String(form.get("link_url") || ""),
          image_url: String(form.get("image_url") || ""),
        };
        const image = form.get("image");
        if (image && typeof image !== "string") {
          try {
            payload.image_url = await uploadImage(
              image.name || "banner.jpg",
              Buffer.from(await image.arrayBuffer())
            );
          } catch (e) {
            logErr("image upload failed", e);
            return err(400, "image upload failed");
          }
        }
      } else {
        const body = await readJson<typeof payload>(req);
        if (!body) return err(400, "invalid json");
        payload = body;
      }
      if (!payload.image_url) return err(400, "image required");
      try {
        return json(await store.createBanner(payload), 201);
      } catch (e) {
        if (e instanceof StoreError && e.code === "conflict") {
          return err(409, `maximum ${store.MAX_BANNERS} banners`);
        }
        return storeFail(e);
      }
    }

    const adminBannerMatch = path.match(/^\/v1\/admin\/banners\/(\d+)$/);
    if (method === "PUT" && adminBannerMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const id = Number(adminBannerMatch[1]);
      const ct = req.headers.get("content-type") || "";
      let payload: { title?: string; subtitle?: string; image_url?: string; link_url?: string } = {};
      if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        payload = {
          title: String(form.get("title") || ""),
          subtitle: String(form.get("subtitle") || ""),
          link_url: String(form.get("link_url") || ""),
          image_url: String(form.get("image_url") || ""),
        };
        const image = form.get("image");
        if (image && typeof image !== "string") {
          try {
            payload.image_url = await uploadImage(
              image.name || "banner.jpg",
              Buffer.from(await image.arrayBuffer())
            );
          } catch (e) {
            logErr("image upload failed", e);
            return err(400, "image upload failed");
          }
        }
      } else {
        const body = await readJson<typeof payload>(req);
        if (!body) return err(400, "invalid json");
        payload = body;
      }
      try {
        return json(await store.updateBanner(id, payload));
      } catch (e) {
        return storeFail(e);
      }
    }

    if (method === "DELETE" && adminBannerMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      try {
        await store.deleteBanner(Number(adminBannerMatch[1]));
        return json({ ok: true });
      } catch (e) {
        return storeFail(e);
      }
    }

    // legacy single-banner update → upsert first banner
    if (method === "PUT" && path === "/v1/admin/banner") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const body = await readJson<{ title?: string; subtitle?: string; image_url?: string; link_url?: string }>(req);
      if (!body) return err(400, "invalid json");
      const list = await store.listBanners();
      if (list[0]) return json(await store.updateBanner(list[0].id, body));
      if (!body.image_url) return err(400, "image required");
      return json(await store.createBanner(body), 201);
    }

    if (method === "GET" && path === "/v1/admin/products") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      return json(await store.listProducts({ includeHidden: true, sort: "newest" }));
    }

    if (method === "POST" && path === "/v1/admin/products") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const body = await readJson<Product>(req);
      if (!body) return err(400, "invalid json");
      if (body.category_name) {
        const c = await store.ensureCategory(body.category_name);
        body.category_id = Number(c.id);
        body.category_ids = [Number(c.id)];
      } else if (body.category_id) {
        body.category_ids = [Number(body.category_id)];
      }
      if (body.brand_name) {
        const b = await store.ensureBrand(body.brand_name);
        body.brand_id = Number(b.id);
      }
      return json(await store.upsertProduct(body, true));
    }

    const adminProductMatch = path.match(/^\/v1\/admin\/products\/(\d+)$/);
    if (method === "PUT" && adminProductMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const id = Number(adminProductMatch[1]);
      let existing: Product;
      try {
        existing = await store.productById(id, true);
      } catch (e) {
        if (e instanceof StoreError && e.code === "not_found") return err(404, "product not found");
        return storeFail(e);
      }
      let p: Product = { ...existing };
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("multipart/form-data")) {
        const form = await req.formData();
        const str = (k: string) => String(form.get(k) || "").trim();
        if (str("name")) p.name = str("name");
        if (str("barcode")) p.barcode = str("barcode");
        if (str("variant")) p.variant = str("variant");
        if (str("description")) p.description = str("description");
        if (str("category_name")) p.category_name = str("category_name");
        if (str("brand_name")) p.brand_name = str("brand_name");
        if (str("condition")) p.condition = str("condition");
        if (str("upload_status")) p.upload_status = str("upload_status");
        if (str("image_url")) p.image_url = str("image_url");
        if (str("buy_price")) p.buy_price = Number(str("buy_price"));
        if (str("sell_price")) p.sell_price = Number(str("sell_price"));
        if (str("margin_pct")) p.margin_pct = Number(str("margin_pct"));
        if (str("stock")) p.stock = Number(str("stock"));
        if (str("weight_g")) p.weight_g = Number(str("weight_g"));
        if (str("length_cm")) p.length_cm = Number(str("length_cm"));
        if (str("width_cm")) p.width_cm = Number(str("width_cm"));
        if (str("height_cm")) p.height_cm = Number(str("height_cm"));
        if (str("hidden")) p.hidden = str("hidden") === "1" || str("hidden").toLowerCase() === "true";
        const image = form.get("image");
        if (image && typeof image !== "string") {
          try {
            const buf = Buffer.from(await image.arrayBuffer());
            p.image_url = await uploadImage(image.name || "product.jpg", buf);
          } catch (e) {
            logErr("image upload failed", e);
            return err(400, "image upload failed");
          }
        }
      } else {
        const body = await readJson<Partial<Product>>(req);
        if (!body) return err(400, "invalid json");
        p = {
          ...existing,
          ...body,
          id: existing.id,
          sku: existing.sku,
          image_url: body.image_url || existing.image_url,
          hidden: body.hidden ?? existing.hidden,
          stock: body.stock ?? existing.stock,
          buy_price: body.buy_price ?? existing.buy_price,
          sell_price: body.sell_price ?? existing.sell_price,
        };
      }
      p.sku = existing.sku;
      if (p.category_name) {
        const c = await store.ensureCategory(p.category_name);
        p.category_id = Number(c.id);
        p.category_ids = [Number(c.id)];
      } else if (p.category_id) {
        p.category_ids = [Number(p.category_id)];
      }
      if (p.brand_name) {
        const b = await store.ensureBrand(p.brand_name);
        p.brand_id = Number(b.id);
      }
      return json(await store.upsertProduct(p, false));
    }

    if (method === "DELETE" && adminProductMatch) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      try {
        await store.deleteProduct(Number(adminProductMatch[1]));
        return json({ ok: true });
      } catch (e) {
        return storeFail(e);
      }
    }

    if (
      method === "POST" &&
      (path === "/v1/admin/products/import" || path === "/v1/admin/products/upload")
    ) {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") return err(400, "file required");
      const name = (file.name || "").toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());
      let products: Product[];
      try {
        if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
          products = parseElectronicsExcel(buf);
        } else {
          products = parseElectronicsCSV(buf.toString("utf8"));
        }
      } catch (e) {
        logErr("invalid import file", e);
        return err(400, "invalid import file");
      }
      const imported: Product[] = [];
      for (const p of products) {
        if (p.category_name) {
          const c = await store.ensureCategory(p.category_name);
          p.category_id = Number(c.id);
          p.category_ids = [Number(c.id)];
        }
        if (p.brand_name) {
          const b = await store.ensureBrand(p.brand_name);
          p.brand_id = Number(b.id);
        }
        imported.push(await store.upsertProduct(p, true));
      }
      return json({ imported: imported.length, products: imported });
    }

    if (method === "POST" && path === "/v1/admin/upload/sign") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      try {
        return json(presign(url.searchParams.get("folder") || undefined));
      } catch (e) {
        logErr("upload sign failed", e);
        return err(400, "upload sign failed");
      }
    }

    if (method === "POST" && path === "/v1/admin/upload") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") return err(400, "file required");
      try {
        const urlOut = await uploadImage(file.name || "upload.jpg", Buffer.from(await file.arrayBuffer()));
        return json({ url: urlOut });
      } catch (e) {
        logErr("image upload failed", e);
        return err(400, "image upload failed");
      }
    }

    if (method === "POST" && path === "/v1/admin/categories") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const body = await readJson<{ name?: string }>(req);
      const name = (body?.name || "").trim();
      if (!name) return err(400, "name required");
      return json(await store.ensureCategory(name));
    }

    if (method === "POST" && path === "/v1/admin/brands") {
      const a = await adminGate();
      if (a instanceof Response) return a;
      const body = await readJson<{ name?: string }>(req);
      const name = (body?.name || "").trim();
      if (!name) return err(400, "name required");
      return json(await store.ensureBrand(name));
    }

    return err(404, "not found");
  } catch (e) {
    return internal(e);
  }
}
