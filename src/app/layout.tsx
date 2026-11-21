import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridal Rental Manager",
  description:
    "Manage a bridal gown & formal suit rental business — catalog, fittings, packages, and handover inspections with deposit escrow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Bridal Rental Manager
            </Link>
            <nav className="flex gap-5 text-sm font-medium">
              <Link href="/" className="hover:text-rose-700">
                Catalog
              </Link>
              <Link href="/fittings" className="hover:text-rose-700">
                Fittings
              </Link>
              <Link href="/calculator" className="hover:text-rose-700">
                Package Calculator
              </Link>
              <Link href="/admin" className="hover:text-rose-700">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-stone-500">
          Bridal Rental Manager — catalog, fittings, packages, inspections &amp;
          deposit escrow.
        </footer>
      </body>
    </html>
  );
}
