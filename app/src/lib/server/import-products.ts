import * as XLSX from "xlsx";
import type { Product } from "./types";

const EXCEL_COL_AQ = 17;

function normalizeHeader(h: string[]) {
  return h.map((v) => String(v || "").trim().toLowerCase());
}

function parseMoney(s: string) {
  const n = Number(String(s).replace(/[",Rp]/gi, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parsePct(s: string) {
  const n = Number(String(s).replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(s: string) {
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseFloatSafe(s: string) {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : 0;
}

function isElectronics(cat: string) {
  const c = cat.toLowerCase().trim();
  return c === "elektronik" || c === "electronics" || c.includes("elektronik");
}

function productsFromRows(rows: string[][], maxCols: number): Product[] {
  if (rows.length < 2) throw new Error("empty sheet");
  let header = normalizeHeader(rows[0]);
  if (maxCols > 0 && header.length > maxCols) header = header.slice(0, maxCols);
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    idx[h] = i;
  });
  const get = (row: string[], ...keys: string[]) => {
    for (const key of keys) {
      const i = idx[key];
      if (i !== undefined && i < row.length) return String(row[i] ?? "").trim();
    }
    return "";
  };
  const out: Product[] = [];
  for (const raw of rows.slice(1)) {
    let row = raw.map((c) => String(c ?? ""));
    if (maxCols > 0 && row.length > maxCols) row = row.slice(0, maxCols);
    const sku0 = (row[0] || "").trim();
    if (!sku0 || sku0.toUpperCase().startsWith("TOTAL")) continue;
    const cat = get(row, "category", "kategori");
    if (!isElectronics(cat)) continue;
    const sell = get(row, "sell price (idr)", "sell_price (idr)", "harga jual (rp)");
    const status = get(row, "status upload");
    const p: Product = {
      id: 0,
      sku: get(row, "sku", "kode sku"),
      barcode: get(row, "barcode", "barcode / ean"),
      name: get(row, "name", "nama produk"),
      variant: get(row, "variant", "varian"),
      description: get(row, "description", "deskripsi produk"),
      buy_price: parseMoney(get(row, "buy_price (idr)", "harga beli (rp)")),
      sell_price: parseMoney(sell),
      margin_pct: parsePct(get(row, "margin %", "margin (%)")),
      stock: parseIntSafe(get(row, "stock", "stok")),
      weight_g: parseIntSafe(get(row, "berat (gr)")),
      length_cm: parseFloatSafe(get(row, "panjang (cm)")),
      width_cm: parseFloatSafe(get(row, "lebar (cm)")),
      height_cm: parseFloatSafe(get(row, "tinggi (cm)")),
      condition: get(row, "kondisi", "condition"),
      upload_status: status,
      image_url: get(row, "url gambar utama"),
      hidden: status.toLowerCase() === "arsip" || status.toLowerCase() === "draft",
      category_name: cat,
      brand_name: get(row, "brand", "merek / brand"),
    };
    if (!p.sku || !p.name) continue;
    out.push(p);
  }
  return out;
}

export function parseElectronicsCSV(text: string): Product[] {
  const wb = XLSX.read(text, { type: "string", FS: "," });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  return productsFromRows(rows as string[][], 0);
}

export function parseElectronicsExcel(buf: ArrayBuffer | Buffer): Product[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  return productsFromRows(rows as string[][], EXCEL_COL_AQ);
}
