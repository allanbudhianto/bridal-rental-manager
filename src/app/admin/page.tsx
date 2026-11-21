import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/pricing";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type FittingWithRelations = Prisma.FittingAppointmentGetPayload<{
  include: { customer: true; item: true };
}>;
type BookingWithRelations = Prisma.BookingGetPayload<{
  include: { customer: true; item: true };
}>;
type EscrowWithBooking = Prisma.DepositEscrowGetPayload<{
  include: { booking: { include: { customer: true; item: true } } };
}>;

export default async function AdminPage() {
  let data: {
    bookingCount: number;
    revenueCents: number;
    upcomingFittings: FittingWithRelations[];
    recentBookings: BookingWithRelations[];
    openEscrows: EscrowWithBooking[];
    itemsOut: number;
  } | null = null;
  let dbError = false;
  try {
    const [bookingCount, revenue, upcomingFittings, recentBookings, openEscrows, itemsOut] =
      await Promise.all([
        prisma.booking.count(),
        prisma.payment.aggregate({
          _sum: { amountCents: true },
          where: { status: "PAID" },
        }),
        prisma.fittingAppointment.findMany({
          where: { status: "SCHEDULED" },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          include: { customer: true, item: true },
        }),
        prisma.booking.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { customer: true, item: true },
        }),
        prisma.depositEscrow.findMany({
          where: { status: { in: ["HELD", "DISPUTED"] } },
          include: { booking: { include: { customer: true, item: true } } },
        }),
        prisma.item.count({ where: { status: "RENTED" } }),
      ]);
    data = {
      bookingCount,
      revenueCents: revenue._sum.amountCents ?? 0,
      upcomingFittings,
      recentBookings,
      openEscrows,
      itemsOut,
    };
  } catch {
    dbError = true;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-1 text-sm text-stone-600">
        Bookings, fittings, revenue and deposits at a glance.
      </p>

      {dbError || !data ? (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not reach the database. Start PostgreSQL and set DATABASE_URL
          (see README), then run <code>npm run db:seed</code>.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded border bg-white p-4">
              <p className="text-xs text-stone-500">Total bookings</p>
              <p className="text-2xl font-bold">{data.bookingCount}</p>
            </div>
            <div className="rounded border bg-white p-4">
              <p className="text-xs text-stone-500">Revenue (paid)</p>
              <p className="text-2xl font-bold">
                {formatCents(data.revenueCents)}
              </p>
            </div>
            <div className="rounded border bg-white p-4">
              <p className="text-xs text-stone-500">Upcoming fittings</p>
              <p className="text-2xl font-bold">{data.upcomingFittings.length}</p>
            </div>
            <div className="rounded border bg-white p-4">
              <p className="text-xs text-stone-500">Items out on rent</p>
              <p className="text-2xl font-bold">{data.itemsOut}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="font-semibold">Upcoming fittings</h2>
              {data.upcomingFittings.length === 0 ? (
                <p className="mt-2 text-sm text-stone-600">None scheduled.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.upcomingFittings.map((f) => (
                    <li key={f.id} className="rounded border bg-white px-3 py-2">
                      {f.scheduledAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
                      · {f.item.name} — {f.customer.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-semibold">Deposits held / disputed</h2>
              {data.openEscrows.length === 0 ? (
                <p className="mt-2 text-sm text-stone-600">
                  No open escrows.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.openEscrows.map((e) => (
                    <li key={e.bookingId} className="rounded border bg-white px-3 py-2">
                      <span
                        className={`font-semibold ${
                          e.status === "DISPUTED"
                            ? "text-red-700"
                            : "text-amber-700"
                        }`}
                      >
                        {e.status}
                      </span>{" "}
                      · {formatCents(e.amountCents)} ·{" "}
                      {e.booking.item.name} — {e.booking.customer.name}
                      <br />
                      <span className="text-xs text-stone-500">
                        Resolve via POST /api/escrow/{e.bookingId}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="mt-8">
            <h2 className="font-semibold">Recent bookings</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="py-1">Customer</th>
                  <th className="py-1">Item</th>
                  <th className="py-1">Dates</th>
                  <th className="py-1">Total</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="py-2">{b.customer.name}</td>
                    <td className="py-2">
                      <Link
                        href={`/items/${b.item.id}`}
                        className="text-rose-700 hover:underline"
                      >
                        {b.item.name}
                      </Link>
                    </td>
                    <td className="py-2">
                      {b.startDate.toISOString().slice(0, 10)} →{" "}
                      {b.endDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2">{formatCents(b.totalCents)}</td>
                    <td className="py-2">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
