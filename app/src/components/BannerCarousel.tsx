"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/api";

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const items = banners.filter((b) => b.image_url);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1e3a5f] px-5 py-10 text-white">
        <p className="text-xs uppercase tracking-wider text-blue-100/80">Promo</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">Get Ready For New Collection</h2>
        <Link
          href="/products"
          className="mt-4 inline-flex rounded-md bg-[#0b2a4a] px-4 py-2 text-sm font-medium"
        >
          View Collections →
        </Link>
      </div>
    );
  }

  const b = items[i];
  const href = b.link_url || "/products";

  return (
    <div className="space-y-2">
      <Link href={href} className="relative block overflow-hidden rounded-2xl bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.image_url} alt={b.title || "Banner"} className="h-44 w-full object-cover sm:h-52" />
        {(b.title || b.subtitle) && (
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 via-black/10 to-transparent p-4 text-white">
            {b.title ? <p className="text-lg font-semibold leading-snug">{b.title}</p> : null}
            {b.subtitle ? <p className="mt-1 text-sm text-white/90">{b.subtitle}</p> : null}
          </div>
        )}
      </Link>
      {items.length > 1 ? (
        <div className="flex justify-center gap-1.5">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Banner ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-slate-800" : "w-1.5 bg-slate-300"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
