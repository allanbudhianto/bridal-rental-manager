import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/pricing";
import BookingForm from "@/components/BookingForm";
import FittingForm from "@/components/FittingForm";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await prisma.item
    .findUnique({
      where: { id: params.id },
      include: {
        bookings: {
          where: { status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] } },
          orderBy: { startDate: "asc" },
          include: { customer: true },
        },
      },
    })
    .catch(() => null);

  if (!item) notFound();

  return (
    <div>
      <Link href="/" className="text-sm text-rose-700 hover:underline">
        ← Back to catalog
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{item.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {item.type} · {item.style} · Size {item.size} · Status {item.status}
      </p>
      {item.description && <p className="mt-3 max-w-2xl">{item.description}</p>}

      <dl className="mt-4 grid max-w-md grid-cols-3 gap-3 text-sm">
        <div className="rounded border bg-white p-3">
          <dt className="text-xs text-stone-500">Rental</dt>
          <dd className="font-bold">{formatCents(item.rentalCents)}</dd>
        </div>
        <div className="rounded border bg-white p-3">
          <dt className="text-xs text-stone-500">Deposit (escrow)</dt>
          <dd className="font-bold">{formatCents(item.depositCents)}</dd>
        </div>
        <div className="rounded border bg-white p-3">
          <dt className="text-xs text-stone-500">Value</dt>
          <dd className="font-bold">{formatCents(item.valueCents)}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <h2 className="font-semibold">Upcoming bookings for this item</h2>
        {item.bookings.length === 0 ? (
          <p className="mt-1 text-sm text-stone-600">
            No live bookings — this item is free for any dates.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {item.bookings.map((b) => (
              <li key={b.id} className="rounded border bg-white px-3 py-2">
                {b.startDate.toISOString().slice(0, 10)} →{" "}
                {b.endDate.toISOString().slice(0, 10)} · {b.customer.name} ·{" "}
                {b.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BookingForm
          itemId={item.id}
          rentalCents={item.rentalCents}
          depositCents={item.depositCents}
        />
        <FittingForm itemId={item.id} itemName={item.name} />
      </div>
    </div>
  );
}
