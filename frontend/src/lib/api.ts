const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export type Product = {
  id: number;
  sku: string;
  name: string;
  sell_price: number;
  stock: number;
  stock_status?: string;
  image_url?: string;
  description?: string;
  brand_name?: string;
  category_name?: string;
  category_id?: number;
  brand_id?: number;
  variant?: string;
  hidden?: boolean;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  weight_g?: number;
  condition?: string;
};

export type Banner = {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
};

export type Category = { id: number; name: string };
export type Brand = { id: number; name: string };

export type Order = {
  id: number;
  order_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note: string;
  items?: {
    product_id: number;
    qty: number;
    unit_price: number;
    product_name: string;
    product_sku: string;
  }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

export function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  home: () =>
    request<{ banner: Banner; categories: Category[]; featured: Product[] }>("/v1/home"),
  products: (qs: string) => request<Product[]>(`/v1/products${qs ? `?${qs}` : ""}`),
  product: (id: number) => request<Product>(`/v1/products/${id}`),
  categories: () => request<Category[]>("/v1/categories"),
  brands: () => request<Brand[]>("/v1/brands"),
  contact: () =>
    request<{
      contact_address: string;
      contact_phone: string;
      whatsapp_url: string;
      map_embed_url: string;
    }>("/v1/contact"),
  placeOrder: (
    body: {
      customer_name: string;
      customer_phone: string;
      customer_address: string;
      note: string;
      lines: { product_id: number; qty: number }[];
    },
    token?: string | null
  ) =>
    request<Order>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(body),
      headers: authHeaders(token),
    }),
  order: (number: string) => request<Order>(`/v1/orders/${number}`),
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string }>("/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { name: string; email: string; phone?: string; address?: string } }>(
      "/v1/auth/login",
      { method: "POST", body: JSON.stringify(body) }
    ),
  adminLogin: (body: { email: string; password: string }) =>
    request<{ token: string }>("/v1/admin/auth/login", { method: "POST", body: JSON.stringify(body) }),
  adminOrders: (token: string) =>
    request<Order[]>("/v1/admin/orders", { headers: authHeaders(token) }),
  adminComplete: (token: string, id: number) =>
    request<Order>(`/v1/admin/orders/${id}/complete`, { method: "POST", headers: authHeaders(token) }),
  adminCancel: (token: string, id: number) =>
    request<Order>(`/v1/admin/orders/${id}/cancel`, { method: "POST", headers: authHeaders(token) }),
  adminProducts: (token: string) =>
    request<Product[]>("/v1/admin/products", { headers: authHeaders(token) }),
  adminUpsertProduct: (token: string, body: Partial<Product> & { sku: string; name: string }) =>
    request<Product>("/v1/admin/products", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  adminUpdateBanner: (token: string, body: Partial<Banner>) =>
    request<Banner>("/v1/admin/banner", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  adminImport: async (token: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/v1/admin/products/import`, {
      method: "POST",
      headers: authHeaders(token),
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data as { imported: number };
  },
};
