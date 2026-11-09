import { api } from "@/lib/api";
import { AddToCart } from "./AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let p: Awaited<ReturnType<typeof api.product>> | null = null;
  try {
    p = await api.product(Number(id));
  } catch {
    return <p>Product not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-teal-100 to-cyan-50">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-teal-700/70">
          {p.brand_name} · {p.category_name}
        </p>
        <h1 className="font-display text-3xl leading-tight">{p.name}</h1>
        <p className="font-display text-2xl text-brand-dark">Rp {p.sell_price.toLocaleString("id-ID")}</p>
        <p className="text-sm text-teal-900/70">{p.description}</p>
        <table className="w-full text-left text-sm">
          <tbody>
            <tr>
              <th className="py-1 pr-3 font-medium">SKU</th>
              <td>{p.sku}</td>
            </tr>
            <tr>
              <th className="py-1 pr-3 font-medium">Variant</th>
              <td>{p.variant || "—"}</td>
            </tr>
            <tr>
              <th className="py-1 pr-3 font-medium">Condition</th>
              <td>{p.condition || "—"}</td>
            </tr>
            <tr>
              <th className="py-1 pr-3 font-medium">Size</th>
              <td>
                {p.length_cm}×{p.width_cm}×{p.height_cm} cm · {p.weight_g} g
              </td>
            </tr>
            <tr>
              <th className="py-1 pr-3 font-medium">Stock</th>
              <td>{p.stock_status === "out_of_stock" ? "Out of stock" : p.stock}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AddToCart product={p} />
    </div>
  );
}
