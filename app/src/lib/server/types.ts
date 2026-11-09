export type Product = {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  /** Primary category (first linked via product_category). */
  category_id?: number | null;
  category_name?: string;
  category_ids?: number[];
  brand_id?: number | null;
  brand_name?: string;
  variant?: string;
  description?: string;
  buy_price: number;
  sell_price: number;
  margin_pct?: number;
  stock: number;
  weight_g?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  condition?: string;
  upload_status?: string;
  image_url?: string;
  hidden: boolean;
  stock_status?: string;
};

export type Banner = {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
};

export type Order = {
  id: number;
  order_number: string;
  status: string;
  user_id?: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  note: string;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  qty: number;
  unit_price: number;
  product_name: string;
  product_sku: string;
};

export function withStockStatus<T extends { stock: number }>(p: T): T & { stock_status: string } {
  const stock_status = p.stock <= 0 ? "out_of_stock" : p.stock <= 5 ? "low" : "in_stock";
  return { ...p, stock_status };
}
