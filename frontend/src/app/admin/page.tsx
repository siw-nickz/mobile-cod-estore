"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type Order, type Product, type Banner } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { adminToken, setAdminToken } = useAuth();
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [banner, setBanner] = useState<Partial<Banner>>({ title: "", subtitle: "", image_url: "" });
  const [importMsg, setImportMsg] = useState("");

  async function refresh(token: string) {
    const [o, p, home] = await Promise.all([api.adminOrders(token), api.adminProducts(token), api.home()]);
    setOrders(o);
    setProducts(p);
    setBanner(home.banner);
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
        <h1 className="font-display text-3xl">Admin</h1>
        <form onSubmit={login} className="space-y-3">
          <input name="email" type="email" required placeholder="Admin email" className="w-full rounded-xl border px-3 py-2" />
          <input name="password" type="password" required placeholder="Password" className="w-full rounded-xl border px-3 py-2" />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded-full bg-brand py-3 font-semibold text-white">Log in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Admin</h1>
        <button className="text-sm underline" onClick={() => setAdminToken(null)}>
          Log out
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl">Banner</h2>
        <input
          className="w-full rounded-xl border px-3 py-2"
          value={banner.title || ""}
          onChange={(e) => setBanner({ ...banner, title: e.target.value })}
          placeholder="Title"
        />
        <input
          className="w-full rounded-xl border px-3 py-2"
          value={banner.subtitle || ""}
          onChange={(e) => setBanner({ ...banner, subtitle: e.target.value })}
          placeholder="Subtitle"
        />
        <input
          className="w-full rounded-xl border px-3 py-2"
          value={banner.image_url || ""}
          onChange={(e) => setBanner({ ...banner, image_url: e.target.value })}
          placeholder="Image URL (Cloudinary)"
        />
        <button
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await api.adminUpdateBanner(adminToken, banner);
            setImportMsg("Banner saved");
          }}
        >
          Save banner
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Import electronics CSV</h2>
        <input
          type="file"
          accept=".csv"
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
        {importMsg ? <p className="text-sm text-teal-800">{importMsg}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Orders</h2>
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-teal-900/10 bg-white p-3 text-sm">
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
                      className="rounded-full bg-brand px-3 py-1 text-white"
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
        <h2 className="font-display text-xl">Products ({products.length})</h2>
        <ul className="space-y-2 text-sm">
          {products.slice(0, 30).map((p) => (
            <li key={p.id} className="rounded-xl border border-teal-900/10 bg-white px-3 py-2">
              {p.sku} · {p.name} · stock {p.stock} {p.hidden ? "(hidden)" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
