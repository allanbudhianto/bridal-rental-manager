import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareInspections, resolveEscrow } from "@/lib/escrow";

export const dynamic = "force-dynamic";

// GET /api/escrow/<bookingId> — the escrow row plus a preview of what
// the comparison would recommend (without changing anything).
export async function GET(
  _req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.bookingId },
      include: {
        inspections: { include: { defects: true } },
        escrow: true,
      },
    });
    if (!booking) {
      return NextResponse.json(
        { error: `Booking not found: ${params.bookingId}` },
        { status: 404 }
      );
    }
    const pre = booking.inspections.find((i) => i.kind === "PRE_RENTAL");
    const post = booking.inspections.find((i) => i.kind === "POST_RETURN");
    const recommendation =
      pre && post ? compareInspections(pre, post) : null;
    return NextResponse.json({
      escrow: booking.escrow,
      recommendation,
      hasPreRentalInspection: Boolean(pre),
      hasPostReturnInspection: Boolean(post),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}

// POST /api/escrow/<bookingId> — resolve the escrow for real: compare the
// pre-rental and post-return defect maps and persist the resulting status
// (RELEASED / DISPUTED / FORFEITED). Fails when either inspection is
// missing or the escrow was already resolved.
export async function POST(
  _req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const result = await resolveEscrow(params.bookingId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not resolve escrow.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
