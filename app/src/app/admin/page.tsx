"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type Order, type Product, type Banner } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const MAX_BANNERS = 5;

export default function AdminPage() {
  const { adminToken, setAdminToken } = useAuth();
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerDraft, setBannerDraft] = useState({ title: "", subtitle: "", link_url: "" });
  const [importMsg, setImportMsg] = useState("");
  const emptyProduct = {
    sku: "",
    name: "",
    category_name: "Elektronik",
    brand_name: "",
    variant: "",
    description: "",
    buy_price: "0",
    sell_price: "0",
    stock: "0",
    hidden: false,
  };
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [showProductForm, setShowProductForm] = useState(false);

  async function refresh(token: string) {
    const [o, p, b] = await Promise.all([
      api.adminOrders(token),
      api.adminProducts(token),
      api.adminBanners(token),
    ]);
    setOrders(o ?? []);
    setProducts(p ?? []);
    setBanners(b ?? []);
  }

  useEffect(() => {
    if (!adminToken) return;
    refresh(adminToken).catch((e) => setError(e.message));
  }, [adminToken]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await api.adminLogin({
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      setAdminToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (!adminToken) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <form onSubmit={login} className="space-y-3">
          <input name="email" type="email" required placeholder="Admin email" className="w-full rounded-xl border px-3 py-2" />
          <input name="password" type="password" required placeholder="Password" className="w-full rounded-xl border px-3 py-2" />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded-full bg-slate-900 py-3 font-semibold text-white">Log in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <button className="text-sm underline" onClick={() => setAdminToken(null)}>
          Log out
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {importMsg ? <p className="text-sm text-emerald-700">{importMsg}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Banners ({banners.length}/{MAX_BANNERS})</h2>
        <p className="text-sm text-slate-600">Upload image to Cloudinary. Max {MAX_BANNERS} banners on home carousel.</p>
        <ul className="space-y-2">
          {banners.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
              {b.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-20 rounded-lg bg-slate-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.title || "(no title)"}</p>
                <p className="truncate text-xs text-slate-500">{b.subtitle}</p>
              </div>
              <button
                className="rounded-full border px-3 py-1 text-xs"
                onClick={async () => {
                  try {
                    await api.adminDeleteBanner(adminToken, b.id);
                    setImportMsg("Banner deleted");
                    await refresh(adminToken);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Delete failed");
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {banners.length < MAX_BANNERS ? (
          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={bannerDraft.title}
              onChange={(e) => setBannerDraft({ ...bannerDraft, title: e.target.value })}
              placeholder="Title"
            />
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={bannerDraft.subtitle}
              onChange={(e) => setBannerDraft({ ...bannerDraft, subtitle: e.target.value })}
              placeholder="Subtitle"
            />
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={bannerDraft.link_url}
              onChange={(e) => setBannerDraft({ ...bannerDraft, link_url: e.target.value })}
              placeholder="Link URL (optional)"
            />
            <label className="block cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white">
              Upload banner image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    await api.adminCreateBanner(adminToken, bannerDraft, file);
                    setBannerDraft({ title: "", subtitle: "", link_url: "" });
                    setImportMsg("Banner uploaded");
                    await refresh(adminToken);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Banner upload failed");
                  }
                }}
              />
            </label>
          </div>
        ) : (
          <p className="text-sm text-amber-700">Maximum {MAX_BANNERS} banners reached. Delete one to add another.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upload products (CSV / Excel)</h2>
        <p className="text-sm text-slate-600">Excel: columns A–Q, Elektronik only.</p>
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const res = await api.adminImport(adminToken, file);
              setImportMsg(`Imported ${res.imported} products`);
              await refresh(adminToken);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Import failed");
            }
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Orders</h2>
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{o.order_number}</p>
                  <p>
                    {o.status} · {o.customer_name}
                  </p>
                </div>
                {o.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      className="rounded-full bg-slate-900 px-3 py-1 text-white"
                      onClick={async () => {
                        await api.adminComplete(adminToken, o.id);
                        await refresh(adminToken);
                      }}
                    >
                      Complete
                    </button>
                    <button
                      className="rounded-full border px-3 py-1"
                      onClick={async () => {
                        await api.adminCancel(adminToken, o.id);
                        await refresh(adminToken);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Products ({products.length})</h2>
          <button
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            onClick={() => {
              setEditingId(null);
              setProductForm(emptyProduct);
              setShowProductForm(true);
            }}
          >
            + Add product
          </button>
        </div>

        {showProductForm ? (
          <form
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const payload = {
                sku: productForm.sku.trim(),
                name: productForm.name.trim(),
                category_name: productForm.category_name.trim(),
                brand_name: productForm.brand_name.trim(),
                variant: productForm.variant.trim(),
                description: productForm.description.trim(),
                buy_price: Number(productForm.buy_price) || 0,
                sell_price: Number(productForm.sell_price) || 0,
                stock: Number(productForm.stock) || 0,
                hidden: productForm.hidden,
              };
              if (!payload.sku || !payload.name) {
                setError("SKU and name are required");
                return;
              }
              try {
                if (editingId == null) {
                  await api.adminUpsertProduct(adminToken, payload);
                  setImportMsg(`Created ${payload.sku}`);
                } else {
                  await api.adminSaveProduct(adminToken, editingId, payload);
                  setImportMsg(`Updated ${payload.sku}`);
                }
                setShowProductForm(false);
                setEditingId(null);
                setProductForm(emptyProduct);
                await refresh(adminToken);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Save product failed");
              }
            }}
          >
            <p className="text-sm font-medium">{editingId == null ? "Create product" : `Edit #${editingId}`}</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="SKU *"
                value={productForm.sku}
                disabled={editingId != null}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                required
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Name *"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Category"
                value={productForm.category_name}
                onChange={(e) => setProductForm({ ...productForm, category_name: e.target.value })}
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Brand"
                value={productForm.brand_name}
                onChange={(e) => setProductForm({ ...productForm, brand_name: e.target.value })}
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Variant"
                value={productForm.variant}
                onChange={(e) => setProductForm({ ...productForm, variant: e.target.value })}
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Stock"
                type="number"
                value={productForm.stock}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Buy price"
                type="number"
                value={productForm.buy_price}
                onChange={(e) => setProductForm({ ...productForm, buy_price: e.target.value })}
              />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Sell price"
                type="number"
                value={productForm.sell_price}
                onChange={(e) => setProductForm({ ...productForm, sell_price: e.target.value })}
              />
            </div>
            <textarea
              className="w-full rounded-lg border px-2 py-1.5 text-sm"
              placeholder="Description"
              rows={2}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={productForm.hidden}
                onChange={(e) => setProductForm({ ...productForm, hidden: e.target.checked })}
              />
              Hidden from storefront
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Save
              </button>
              <button
                type="button"
                className="rounded-full border px-4 py-2 text-sm"
                onClick={() => {
                  setShowProductForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <ul className="space-y-2 text-sm">
          {products.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100" />
                  )}
                  <div>
                    <p className="font-medium">
                      {p.sku} · {p.name}
                    </p>
                    <p className="text-slate-600">
                      Rp {Number(p.sell_price).toLocaleString("id-ID")} · stock {p.stock}
                      {p.hidden ? " · hidden" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    className="rounded-full border px-2 py-1 text-xs"
                    onClick={() => {
                      setEditingId(p.id);
                      setProductForm({
                        sku: p.sku,
                        name: p.name,
                        category_name: p.category_name || "",
                        brand_name: p.brand_name || "",
                        variant: p.variant || "",
                        description: p.description || "",
                        buy_price: String(p.buy_price ?? 0),
                        sell_price: String(p.sell_price ?? 0),
                        stock: String(p.stock ?? 0),
                        hidden: Boolean(p.hidden),
                      });
                      setShowProductForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <label className="cursor-pointer rounded-full border px-2 py-1 text-xs font-semibold">
                    Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const updated = await api.adminUpdateProduct(adminToken, p.id, {}, file);
                          setImportMsg(`Image saved for ${updated.sku}`);
                          await refresh(adminToken);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Image upload failed");
                        }
                      }}
                    />
                  </label>
                  <button
                    className="rounded-full border px-2 py-1 text-xs"
                    onClick={async () => {
                      try {
                        await api.adminSaveProduct(adminToken, p.id, { hidden: !p.hidden });
                        setImportMsg(p.hidden ? `Shown ${p.sku}` : `Hidden ${p.sku}`);
                        await refresh(adminToken);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Update failed");
                      }
                    }}
                  >
                    {p.hidden ? "Show" : "Hide"}
                  </button>
                  <button
                    className="rounded-full border border-red-200 px-2 py-1 text-xs text-red-700"
                    onClick={async () => {
                      if (!confirm(`Hide/delete ${p.sku} from catalog?`)) return;
                      try {
                        await api.adminDeleteProduct(adminToken, p.id);
                        setImportMsg(`Deleted ${p.sku}`);
                        await refresh(adminToken);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Delete failed");
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
