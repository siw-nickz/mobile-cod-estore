"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function CartPage() {
  const { lines, setQty, remove, total } = useCart();

  if (lines.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl">Cart</h1>
        <p className="text-sm text-teal-900/60">Your cart is empty.</p>
        <Link href="/products" className="text-brand underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Cart</h1>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.product_id} className="rounded-2xl border border-teal-900/10 bg-white p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-medium">{l.name}</p>
                <p className="text-sm text-teal-800/70">Rp {l.sell_price.toLocaleString("id-ID")}</p>
              </div>
              <button className="text-xs text-red-700" onClick={() => remove(l.product_id)}>
                Remove
              </button>
            </div>
            <input
              type="number"
              min={1}
              value={l.qty}
              onChange={(e) => setQty(l.product_id, Number(e.target.value))}
              className="mt-2 w-20 rounded-lg border border-teal-900/15 px-2 py-1 text-sm"
            />
          </li>
        ))}
      </ul>
      <p className="font-display text-xl">Total Rp {total.toLocaleString("id-ID")}</p>
      <Link href="/checkout" className="block rounded-full bg-brand py-3 text-center font-semibold text-white">
        Checkout (COD)
      </Link>
    </div>
  );
}
