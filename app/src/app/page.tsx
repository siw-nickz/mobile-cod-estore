import Link from "next/link";
import { api } from "@/lib/api";
import { BannerCarousel } from "@/components/BannerCarousel";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  let banners: Awaited<ReturnType<typeof api.home>>["banners"] = [];
  let categories: { id: number; name: string }[] = [];
  let products: Awaited<ReturnType<typeof api.home>>["products"] = [];
  try {
    const home = await api.home();
    banners = home.banners || (home.banner?.image_url ? [home.banner] : []);
    categories = home.categories || [];
    products = home.products || home.featured || [];
  } catch {
    /* API may be offline during preview */
  }

  return (
    <div className="-mx-4 space-y-5 bg-white px-4 pb-6 pt-1">
      <BannerCarousel banners={banners} />

      {categories.length > 0 ? (
        <section className="space-y-3">
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 scrollbar-none">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category_id=${c.id}`}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="w-full truncate text-center text-xs text-slate-700">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Products</h2>
          <Link
            href="/products"
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
          >
            View All
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">No products yet. Import from admin.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
