import Link from "next/link";
import { api } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  let banner = { title: "COD Electronics", subtitle: "Shop on your phone", image_url: "", link_url: "" };
  let categories: { id: number; name: string }[] = [];
  let featured: Awaited<ReturnType<typeof api.home>>["featured"] = [];
  try {
    const home = await api.home();
    banner = home.banner;
    categories = home.categories || [];
    featured = home.featured || [];
  } catch {
    /* API may be offline during static preview */
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-brand-dark text-white">
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        ) : null}
        <div className="relative space-y-3 px-6 py-12">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-100">Cash on delivery</p>
          <h1 className="font-display text-4xl leading-tight">{banner.title || "COD Store"}</h1>
          <p className="max-w-sm text-teal-50/90">{banner.subtitle}</p>
          <Link
            href="/products"
            className="inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-dark"
          >
            Browse products
          </Link>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category_id=${c.id}`}
                className="rounded-full border border-teal-800/15 bg-white px-3 py-1.5 text-sm"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Featured</h2>
        {featured.length === 0 ? (
          <p className="text-sm text-teal-900/60">No products yet. Import electronics CSV from admin.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
