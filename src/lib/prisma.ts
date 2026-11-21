import { PrismaClient } from "@prisma/client";

// Singleton Prisma client (Next.js dev-mode safe: avoids opening a new
// connection pool on every hot reload).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
