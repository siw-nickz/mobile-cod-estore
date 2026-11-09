"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ProductFilters({
  brands,
  categories,
}: {
  brands: { id: number; name: string }[];
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/products?${next.toString()}`);
  }

  return (
    <form
      className="space-y-2 rounded-2xl border border-teal-900/10 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        update("q", String(fd.get("q") || ""));
      }}
    >
      <input
        name="q"
        defaultValue={sp.get("q") || ""}
        placeholder="Search name, brand, model"
        className="w-full rounded-xl border border-teal-900/15 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="rounded-xl border border-teal-900/15 px-2 py-2 text-sm"
          value={sp.get("category_id") || ""}
          onChange={(e) => update("category_id", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-teal-900/15 px-2 py-2 text-sm"
          value={sp.get("brand_id") || ""}
          onChange={(e) => update("brand_id", e.target.value)}
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <select
        className="w-full rounded-xl border border-teal-900/15 px-2 py-2 text-sm"
        value={sp.get("sort") || ""}
        onChange={(e) => update("sort", e.target.value)}
      >
        <option value="">Sort: name</option>
        <option value="price_asc">Price ↑</option>
        <option value="price_desc">Price ↓</option>
        <option value="newest">Newest</option>
      </select>
      <button type="submit" className="w-full rounded-xl bg-brand py-2 text-sm font-semibold text-white">
        Search
      </button>
    </form>
  );
}
