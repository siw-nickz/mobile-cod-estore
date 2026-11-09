"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

export default function CheckoutPage() {
  const { lines, clear, total } = useCart();
  const { token } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (lines.length === 0) {
    return <p className="text-sm">Cart is empty.</p>;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const order = await api.placeOrder(
        {
          customer_name: String(fd.get("name")),
          customer_phone: String(fd.get("phone")),
          customer_address: String(fd.get("address")),
          note: String(fd.get("note") || ""),
          lines: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
        },
        token
      );
      clear();
      router.push(`/order/${order.order_number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Checkout</h1>
      <p className="text-sm text-teal-900/70">Cash on delivery · Total Rp {total.toLocaleString("id-ID")}</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="name" required placeholder="Full name" className="w-full rounded-xl border px-3 py-2" />
        <input name="phone" required placeholder="Phone" className="w-full rounded-xl border px-3 py-2" />
        <textarea
          name="address"
          required
          placeholder="Delivery address"
          className="w-full rounded-xl border px-3 py-2"
          rows={3}
        />
        <textarea name="note" placeholder="Note (optional)" className="w-full rounded-xl border px-3 py-2" rows={2} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-full bg-brand py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Placing order…" : "Place COD order"}
        </button>
      </form>
    </div>
  );
}
