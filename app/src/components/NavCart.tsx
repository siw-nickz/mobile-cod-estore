"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function NavCart() {
  const { count } = useCart();
  return (
    <Link href="/cart" aria-label={`Cart ${count}`} className="relative text-slate-800">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 7h15l-1.5 9h-12z" />
        <path d="M6 7l-1-3H2" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
