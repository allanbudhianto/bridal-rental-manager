import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/inspections?bookingId=<id> — inspections with their defect maps.
export async function GET(req: NextRequest) {
  try {
    const bookingId = req.nextUrl.searchParams.get("bookingId");
    const inspections = await prisma.handoverInspection.findMany({
      where: bookingId ? { bookingId } : {},
      orderBy: { takenAt: "asc" },
      include: { defects: true },
    });
    return NextResponse.json(inspections);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}

// POST /api/inspections
// Body: {
//   bookingId, kind: "PRE_RENTAL" | "POST_RETURN", photoUrl, inspectorId,
//   conditionScore (1–5), notes?, defects?: [{ zone, defectType, photoUrl }]
// }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, kind, photoUrl, inspectorId, conditionScore, notes, defects } =
      body as {
        bookingId?: string;
        kind?: "PRE_RENTAL" | "POST_RETURN";
        photoUrl?: string;
        inspectorId?: string;
        conditionScore?: number;
        notes?: string;
        defects?: { zone?: string; defectType?: string; photoUrl?: string }[];
      };
    if (!bookingId || !kind || !photoUrl || !inspectorId) {
      return NextResponse.json(
        { error: "bookingId, kind, photoUrl and inspectorId are required." },
        { status: 400 }
      );
    }
    if (kind !== "PRE_RENTAL" && kind !== "POST_RETURN") {
      return NextResponse.json(
        { error: 'kind must be "PRE_RENTAL" or "POST_RETURN".' },
        { status: 400 }
      );
    }
    if (
      typeof conditionScore !== "number" ||
      !Number.isInteger(conditionScore) ||
      conditionScore < 1 ||
      conditionScore > 5
    ) {
      return NextResponse.json(
        { error: "conditionScore must be an integer between 1 and 5." },
        { status: 400 }
      );
    }
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return NextResponse.json({ error: `Booking not found: ${bookingId}` }, { status: 404 });
    }
    const cleanDefects = (defects ?? []).filter(
      (d) => d.zone && d.defectType && d.photoUrl
    );
    const inspection = await prisma.handoverInspection.create({
      data: {
        bookingId,
        kind,
        photoUrl,
        inspectorId,
        conditionScore,
        notes: notes || null,
        defects: {
          create: cleanDefects.map((d) => ({
            zone: d.zone as string,
            defectType: d.defectType as string,
            photoUrl: d.photoUrl as string,
          })),
        },
      },
      include: { defects: true },
    });
    return NextResponse.json({ inspection }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}
