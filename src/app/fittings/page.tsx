import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type FittingWithRelations = Prisma.FittingAppointmentGetPayload<{
  include: { customer: true; item: true };
}>;

export default async function FittingsPage() {
  let fittings: FittingWithRelations[] = [];
  let dbError = false;
  try {
    fittings = await prisma.fittingAppointment.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      include: { customer: true, item: true },
    });
  } catch {
    dbError = true;
  }

  // Group by calendar day for a simple calendar-style view.
  const byDay = new Map<string, typeof fittings>();
  for (const f of fittings) {
    const day = f.scheduledAt.toISOString().slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(f);
    byDay.set(day, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Fitting schedule</h1>
      <p className="mt-1 text-sm text-stone-600">
        Book a fitting from an item page, or view the upcoming schedule here.
        An item cannot have two fittings at the same time.
      </p>

      {dbError && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not reach the database. Start PostgreSQL and set DATABASE_URL
          (see README).
        </p>
      )}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="mt-6">
          <h2 className="font-semibold">{day}</h2>
          <ul className="mt-2 space-y-2">
            {list.map((f) => (
              <li key={f.id} className="rounded border bg-white px-4 py-3 text-sm">
                <span className="font-semibold">
                  {f.scheduledAt.toISOString().slice(11, 16)}
                </span>{" "}
                · {f.item.name} ({f.item.size}) — {f.customer.name}
                {f.notes ? ` · ${f.notes}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!dbError && fittings.length === 0 && (
        <p className="mt-6 text-sm text-stone-600">
          No fittings scheduled. Open an item in the catalog to book one.
        </p>
      )}
    </div>
  );
}
