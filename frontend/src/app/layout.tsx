import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { NavCart } from "@/components/NavCart";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "COD Electronics Store",
  description: "Mobile-first cash on delivery electronics shop",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <Providers>
          <header className="sticky top-0 z-20 border-b border-teal-900/10 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="font-display text-xl font-semibold tracking-tight text-brand-dark">
                COD Store
              </Link>
              <nav className="flex items-center gap-3 text-sm font-medium text-teal-900/80">
                <Link href="/products">Shop</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/account">Account</Link>
                <NavCart />
              </nav>
            </div>
          </header>
          <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-5">{children}</main>
          <footer className="mx-auto max-w-lg px-4 py-8 text-center text-xs text-teal-900/50">
            Cash on delivery · Free-tier MVP
          </footer>
        </Providers>
      </body>
    </html>
  );
}
