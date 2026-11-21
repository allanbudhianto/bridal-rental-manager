import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/pricing";
import { isItemAvailable } from "@/lib/availability";
import type { Item } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  size?: string;
  style?: string;
  minPrice?: string;
  maxPrice?: string;
  from?: string;
  to?: string;
};

const TYPE_OPTIONS = ["GOWN", "SUIT", "ACCESSORY"];

function statusBadge(status: Item["status"]) {
  const styles: Record<Item["status"], string> = {
    AVAILABLE: "bg-emerald-100 text-emerald-800",
    RENTED: "bg-amber-100 text-amber-800",
    MAINTENANCE: "bg-sky-100 text-sky-800",
    RETIRED: "bg-stone-200 text-stone-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = searchParams.q?.trim() || "";
  const type = TYPE_OPTIONS.includes(searchParams.type ?? "")
    ? searchParams.type!
    : "";
  const size = searchParams.size?.trim() || "";
  const style = searchParams.style?.trim() || "";
  const minPrice = searchParams.minPrice
    ? Math.round(Number(searchParams.minPrice) * 100)
    : undefined;
  const maxPrice = searchParams.maxPrice
    ? Math.round(Number(searchParams.maxPrice) * 100)
    : undefined;
  const from = searchParams.from || "";
  const to = searchParams.to || "";

  let items: Item[] = [];
  let dbError = false;
  try {
    items = await prisma.item.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(type ? { type: type as Item["type"] } : {}),
        ...(size ? { size: { contains: size, mode: "insensitive" } } : {}),
        ...(style ? { style: { contains: style, mode: "insensitive" } } : {}),
        ...(minPrice !== undefined ? { rentalCents: { gte: minPrice } } : {}),
        ...(maxPrice !== undefined ? { rentalCents: { lte: maxPrice } } : {}),
      },
      orderBy: { name: "asc" },
    });
  } catch {
    dbError = true;
  }

  // Optional availability filter for a rental window.
  let availableIds: Set<string> | null = null;
  if (from && to && !dbError) {
    const start = new Date(from);
    const end = new Date(to);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      const checks = await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          ok: await isItemAvailable(item.id, start, end).catch(() => true),
        }))
      );
      availableIds = new Set(checks.filter((c) => c.ok).map((c) => c.id));
    }
  }
  const visibleItems = availableIds
    ? items.filter((item) => availableIds!.has(item.id))
    : items;

  return (
    <div>
      <h1 className="text-2xl font-bold">Catalog</h1>
      <p className="mt-1 text-sm text-stone-600">
        Gowns, suits and accessories available to rent. Filter by type, size,
        style and price — or check availability for your rental dates.
      </p>

      {dbError && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not reach the database. Start PostgreSQL and set DATABASE_URL
          (see README), then run <code>npm run db:seed</code>.
        </p>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <label className="text-xs font-semibold">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. silk gown"
            className="mt-1 block w-48 rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Type
          <select
            name="type"
            defaultValue={type}
            className="mt-1 block rounded border px-2 py-1 text-sm font-normal"
          >
            <option value="">All</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Size
          <input
            name="size"
            defaultValue={size}
            placeholder="M, 48R…"
            className="mt-1 block w-24 rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Style
          <input
            name="style"
            defaultValue={style}
            placeholder="A-line…"
            className="mt-1 block w-32 rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Min price ($)
          <input
            name="minPrice"
            type="number"
            min={0}
            defaultValue={searchParams.minPrice ?? ""}
            className="mt-1 block w-24 rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          Max price ($)
          <input
            name="maxPrice"
            type="number"
            min={0}
            defaultValue={searchParams.maxPrice ?? ""}
            className="mt-1 block w-24 rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          From
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 block rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-semibold">
          To
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 block rounded border px-2 py-1 text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
        >
          Filter
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-600">
        {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
        {from && to ? ` available ${from} → ${to}` : ""}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={`/items/${item.id}`}
            className="rounded border bg-white p-4 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{item.name}</h2>
              {statusBadge(item.status)}
            </div>
            <p className="mt-1 text-sm text-stone-600">
              {item.type} · {item.style} · Size {item.size}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-bold">{formatCents(item.rentalCents)}</span>{" "}
              rental · {formatCents(item.depositCents)} deposit
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Value {formatCents(item.valueCents)}
            </p>
          </Link>
        ))}
      </div>

      {!dbError && visibleItems.length === 0 && (
        <p className="mt-6 text-sm text-stone-600">
          No items match these filters. Try widening the price range or
          clearing the dates.
        </p>
      )}
    </div>
  );
}
