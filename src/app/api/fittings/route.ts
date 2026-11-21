import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasFittingConflict } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/fittings — upcoming scheduled fittings.
export async function GET() {
  try {
    const fittings = await prisma.fittingAppointment.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      include: { customer: true, item: true },
    });
    return NextResponse.json(fittings);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}

// POST /api/fittings
// Body: { itemId, customerName, customerEmail, scheduledAt, durationMin?, notes? }
// Rejects a fitting that overlaps another scheduled fitting for the same
// item with HTTP 409.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, customerName, customerEmail, scheduledAt, durationMin, notes } =
      body as {
        itemId?: string;
        customerName?: string;
        customerEmail?: string;
        scheduledAt?: string;
        durationMin?: number;
        notes?: string;
      };
    if (!itemId || !customerName || !customerEmail || !scheduledAt) {
      return NextResponse.json(
        { error: "itemId, customerName, customerEmail and scheduledAt are required." },
        { status: 400 }
      );
    }
    const at = new Date(scheduledAt);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt." }, { status: 400 });
    }
    const minutes = durationMin && durationMin > 0 ? Math.floor(durationMin) : 60;

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: `Item not found: ${itemId}` }, { status: 404 });
    }
    if (await hasFittingConflict(itemId, at, minutes)) {
      return NextResponse.json(
        { error: "This item already has a fitting at an overlapping time." },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: { name: customerName },
      create: { name: customerName, email: customerEmail },
    });
    const fitting = await prisma.fittingAppointment.create({
      data: {
        customerId: customer.id,
        itemId: item.id,
        scheduledAt: at,
        durationMin: minutes,
        notes: notes || null,
      },
    });
    return NextResponse.json({ fitting }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}
