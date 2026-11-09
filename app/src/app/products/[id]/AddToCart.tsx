"use client";

import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/api";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const disabled = product.stock <= 0;
  return (
    <button
      disabled={disabled}
      onClick={() => add(product, 1)}
      className="w-full rounded-full bg-brand py-3 font-semibold text-white disabled:opacity-40"
    >
      {disabled ? "Out of stock" : "Add to cart"}
    </button>
  );
}
