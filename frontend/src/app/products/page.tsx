import { Suspense } from "react";
import { api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "./filters";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.category_id) qs.set("category_id", sp.category_id);
  if (sp.brand_id) qs.set("brand_id", sp.brand_id);
  if (sp.min_price) qs.set("min_price", sp.min_price);
  if (sp.max_price) qs.set("max_price", sp.max_price);
  if (sp.sort) qs.set("sort", sp.sort);

  let products: Awaited<ReturnType<typeof api.products>> = [];
  let brands: Awaited<ReturnType<typeof api.brands>> = [];
  let categories: Awaited<ReturnType<typeof api.categories>> = [];
  try {
    [products, brands, categories] = await Promise.all([
      api.products(qs.toString()),
      api.brands(),
      api.categories(),
    ]);
  } catch {
    /* offline */
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Shop</h1>
      <Suspense fallback={<p className="text-sm">Loading filters…</p>}>
        <ProductFilters brands={brands} categories={categories} />
      </Suspense>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
      {products.length === 0 ? <p className="text-sm text-teal-900/60">No products match.</p> : null}
    </div>
  );
}
