"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "./api";

export type CartLine = {
  product_id: number;
  name: string;
  sell_price: number;
  image_url?: string;
  qty: number;
};

type CartCtx = {
  lines: CartLine[];
  add: (p: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  count: number;
  total: number;
};

const KEY = "cod_cart_v1";
const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const add = (p: Product, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product_id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          sell_price: p.sell_price,
          image_url: p.image_url,
          qty,
        },
      ];
    });
  };

  const setQty = (productId: number, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.product_id === productId ? { ...l, qty } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const remove = (productId: number) => setLines((prev) => prev.filter((l) => l.product_id !== productId));
  const clear = () => setLines([]);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.qty * l.sell_price, 0);

  return (
    <Ctx.Provider value={{ lines, add, setQty, remove, clear, count, total }}>{children}</Ctx.Provider>
  );
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("CartProvider missing");
  return v;
}
