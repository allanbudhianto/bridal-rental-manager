import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findConflictingBookings } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/bookings — most recent bookings first.
export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { customer: true, item: true, escrow: true },
    });
    return NextResponse.json(bookings);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}

// POST /api/bookings
// Body: { itemId, customerName, customerEmail, startDate, endDate }
// Creates the booking (CONFIRMED), holds the item's deposit in escrow,
// and opens a PENDING payment for the rental price. Rejects overlapping
// bookings for the same item with HTTP 409.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, customerName, customerEmail, startDate, endDate } = body as {
      itemId?: string;
      customerName?: string;
      customerEmail?: string;
      startDate?: string;
      endDate?: string;
    };
    if (!itemId || !customerName || !customerEmail || !startDate || !endDate) {
      return NextResponse.json(
        { error: "itemId, customerName, customerEmail, startDate and endDate are required." },
        { status: 400 }
      );
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return NextResponse.json(
        { error: "Invalid dates: endDate must be after startDate." },
        { status: 400 }
      );
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: `Item not found: ${itemId}` }, { status: 404 });
    }
    if (item.status === "RETIRED" || item.status === "MAINTENANCE") {
      return NextResponse.json(
        { error: `Item is ${item.status.toLowerCase()} and cannot be booked.` },
        { status: 409 }
      );
    }

    const conflicts = await findConflictingBookings(itemId, start, end);
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Item is already booked for overlapping dates.",
          conflicts: conflicts.map((c) => ({
            id: c.id,
            startDate: c.startDate,
            endDate: c.endDate,
            status: c.status,
          })),
        },
        { status: 409 }
      );
    }

    const booking = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: customerEmail },
        update: { name: customerName },
        create: { name: customerName, email: customerEmail },
      });
      const created = await tx.booking.create({
        data: {
          customerId: customer.id,
          itemId: item.id,
          startDate: start,
          endDate: end,
          status: "CONFIRMED",
          totalCents: item.rentalCents,
        },
      });
      await tx.depositEscrow.create({
        data: {
          bookingId: created.id,
          amountCents: item.depositCents,
          status: "HELD",
        },
      });
      await tx.payment.create({
        data: {
          bookingId: created.id,
          amountCents: item.rentalCents,
          method: "card",
          status: "PENDING",
        },
      });
      return created;
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}
