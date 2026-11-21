"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBundlePrice,
  formatCents,
  type BundleItem,
} from "@/lib/pricing";

type PackageOption = {
  id: string;
  name: string;
  description: string | null;
  discountPercent: number;
  items: { item: BundleItem }[];
};

type CatalogItem = BundleItem & { size: string };

// Package calculator: pick a package (or build a custom bundle), see the
// price update live — subtotal, package discount, complete-look bonus,
// and the 25% discount cap, all itemised.
export default function CalculatorPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/items").then((r) => r.json()),
      fetch("/api/packages").then((r) => r.json()),
    ])
      .then(([itemsData, packagesData]) => {
        if (Array.isArray(itemsData)) setItems(itemsData);
        if (Array.isArray(packagesData)) setPackages(packagesData);
      })
      .catch(() => setError("Could not load catalog data. Is the database up?"));
  }, []);

  function applyPackage(pkgId: string) {
    setSelectedPackageId(pkgId);
    if (!pkgId) return;
    const pkg = packages.find((p) => p.id === pkgId);
    if (pkg) setSelectedItemIds(new Set(pkg.items.map((pi) => pi.item.id)));
  }

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedPackageId("");
  }

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.has(item.id)),
    [items, selectedItemIds]
  );
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const breakdown = useMemo(
    () =>
      calculateBundlePrice(
        selectedItems,
        selectedPackage ? selectedPackage.discountPercent : 0
      ),
    [selectedItems, selectedPackage]
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Package calculator</h1>
      <p className="mt-1 text-sm text-stone-600">
        Pick a package or build your own bundle. A bundle with a gown, a suit
        and an accessory earns an extra 5% complete-look bonus; total
        discounts are capped at 25%.
      </p>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label className="text-xs font-semibold">
            Package
            <select
              value={selectedPackageId}
              onChange={(e) => applyPackage(e.target.value)}
              className="mt-1 block w-full rounded border px-2 py-2 text-sm font-normal"
            >
              <option value="">Custom bundle (no package)</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} — {pkg.discountPercent}% off
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold">Items</legend>
            <div className="mt-2 space-y-2">
              {items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"
                >
                  <span>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="mr-2"
                    />
                    {item.name} · {item.type} · {item.size}
                  </span>
                  <span className="font-semibold">
                    {formatCents(item.rentalCents)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="h-fit rounded border bg-white p-4">
          <h2 className="font-semibold">Price breakdown</h2>
          {breakdown.lines.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">
              Select items to see the price.
            </p>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              {breakdown.lines.map((line) => (
                <p key={line.itemId} className="flex justify-between">
                  <span>{line.name}</span>
                  <span>{formatCents(line.rentalCents)}</span>
                </p>
              ))}
              <hr />
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCents(breakdown.subtotalCents)}</span>
              </p>
              {breakdown.packageDiscountCents > 0 && (
                <p className="flex justify-between text-emerald-700">
                  <span>Package discount</span>
                  <span>−{formatCents(breakdown.packageDiscountCents)}</span>
                </p>
              )}
              {breakdown.completeLookBonusCents > 0 && (
                <p className="flex justify-between text-emerald-700">
                  <span>Complete-look bonus</span>
                  <span>−{formatCents(breakdown.completeLookBonusCents)}</span>
                </p>
              )}
              <hr />
              <p className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatCents(breakdown.totalCents)}</span>
              </p>
              {breakdown.appliedRules.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-stone-600">
                  {breakdown.appliedRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
