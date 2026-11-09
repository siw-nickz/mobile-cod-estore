import { api } from "@/lib/api";

export default async function OrderConfirmPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  let order: Awaited<ReturnType<typeof api.order>> | null = null;
  try {
    order = await api.order(number);
  } catch {
    return <p>Order not found.</p>;
  }

  return (
    <div className="space-y-4 rounded-3xl border border-teal-900/10 bg-white p-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Order placed</p>
      <h1 className="font-display text-3xl">{order.order_number}</h1>
      <p className="text-sm text-teal-900/70">Status: {order.status}</p>
      <p className="text-sm">
        We will deliver COD to {order.customer_name}. Keep this order number.
      </p>
    </div>
  );
}
