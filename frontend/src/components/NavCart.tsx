"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function NavCart() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="rounded-full bg-brand px-3 py-1 text-white">
      Cart {count > 0 ? `(${count})` : ""}
    </Link>
  );
}
