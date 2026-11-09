import Link from "next/link";
import type { Product } from "@/lib/api";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link href={`/products/${p.id}`} className="block overflow-hidden rounded-xl bg-white">
      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-slate-100">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="space-y-0.5 pt-2">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{p.name}</h3>
        <p className="text-sm font-semibold text-slate-800">Rp {Number(p.sell_price).toLocaleString("id-ID")}</p>
      </div>
    </Link>
  );
}
