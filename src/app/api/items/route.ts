import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isItemAvailable } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/items?type=GOWN&size=M&style=A-line&minPrice=100&maxPrice=1500&q=silk&from=2026-12-01&to=2026-12-03
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() || undefined;
    const type = params.get("type") || undefined;
    const size = params.get("size") || undefined;
    const style = params.get("style") || undefined;
    const minPrice = params.get("minPrice")
      ? Math.round(Number(params.get("minPrice")) * 100)
      : undefined;
    const maxPrice = params.get("maxPrice")
      ? Math.round(Number(params.get("maxPrice")) * 100)
      : undefined;

    const items = await prisma.item.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(type ? { type: type as "GOWN" | "SUIT" | "ACCESSORY" } : {}),
        ...(size ? { size: { contains: size, mode: "insensitive" } } : {}),
        ...(style ? { style: { contains: style, mode: "insensitive" } } : {}),
        ...(minPrice !== undefined ? { rentalCents: { gte: minPrice } } : {}),
        ...(maxPrice !== undefined ? { rentalCents: { lte: maxPrice } } : {}),
      },
      orderBy: { name: "asc" },
    });

    const from = params.get("from");
    const to = params.get("to");
    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        const available = [];
        for (const item of items) {
          if (await isItemAvailable(item.id, start, end)) available.push(item);
        }
        return NextResponse.json(available);
      }
    }
    return NextResponse.json(items);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}
