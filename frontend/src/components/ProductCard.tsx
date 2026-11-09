import Link from "next/link";
import type { Product } from "@/lib/api";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/products/${p.id}`}
      className="block overflow-hidden rounded-2xl border border-teal-900/10 bg-white shadow-sm"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-teal-100 to-cyan-50">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs uppercase tracking-wide text-teal-700/70">{p.brand_name || "Brand"}</p>
        <h3 className="line-clamp-2 font-medium leading-snug">{p.name}</h3>
        <p className="font-display text-lg text-brand-dark">
          Rp {p.sell_price.toLocaleString("id-ID")}
        </p>
        <p className="text-xs text-teal-800/60">
          {p.stock_status === "out_of_stock" ? "Out of stock" : `Stock ${p.stock}`}
        </p>
      </div>
    </Link>
  );
}
