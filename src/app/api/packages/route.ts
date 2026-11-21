import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/packages — packages with their items (for the calculator).
export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      include: { items: { include: { item: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(packages);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that PostgreSQL is running." },
      { status: 500 }
    );
  }
}
