import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { NavCart } from "@/components/NavCart";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "COD Electronics Store",
  description: "Mobile-first cash on delivery electronics shop",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} font-sans antialiased text-slate-900`}>
        <Providers>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Link href="/products" aria-label="Menu" className="text-slate-800">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </Link>
                <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
                  COD Electronics
                </Link>
              </div>
              <nav className="flex items-center gap-3 text-slate-800">
                <Link href="/products" aria-label="Search">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3-3" />
                  </svg>
                </Link>
                <Link href="/account" aria-label="Account" className="hidden text-xs font-medium sm:inline">
                  Account
                </Link>
                <NavCart />
              </nav>
            </div>
          </header>
          <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-4">{children}</main>
          <footer className="mx-auto max-w-lg px-4 py-8 text-center text-xs text-slate-400">
            Cash on delivery
          </footer>
        </Providers>
      </body>
    </html>
  );
}
