// Availability / overlap protection. The same item cannot be double-booked
// for overlapping rental dates, and cannot have two fittings at the same
// time. Rental dates are half-open [start, end) ranges: a gown returned
// on the 16th can go out again on the 16th.

import { prisma } from "./prisma";

/** True when two half-open date ranges share at least one day. */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type ConflictingBooking = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

/**
 * Find live bookings for an item that overlap [start, end).
 * PENDING / CONFIRMED / ACTIVE bookings block the item; RETURNED and
 * CANCELLED ones do not. Pass `excludeBookingId` when editing a booking.
 */
export async function findConflictingBookings(
  itemId: string,
  start: Date,
  end: Date,
  excludeBookingId?: string
): Promise<ConflictingBooking[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      itemId,
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true, startDate: true, endDate: true, status: true },
  });
  return bookings.filter((b) =>
    rangesOverlap(start, end, b.startDate, b.endDate)
  );
}

export async function isItemAvailable(
  itemId: string,
  start: Date,
  end: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const conflicts = await findConflictingBookings(
    itemId,
    start,
    end,
    excludeBookingId
  );
  return conflicts.length === 0;
}

/** True when a fitting for the same item overlaps the given time window. */
export async function hasFittingConflict(
  itemId: string,
  scheduledAt: Date,
  durationMin: number,
  excludeFittingId?: string
): Promise<boolean> {
  const windowEnd = new Date(scheduledAt.getTime() + durationMin * 60_000);
  const fittings = await prisma.fittingAppointment.findMany({
    where: {
      itemId,
      status: "SCHEDULED",
      ...(excludeFittingId ? { id: { not: excludeFittingId } } : {}),
    },
    select: { scheduledAt: true, durationMin: true },
  });
  return fittings.some((f) => {
    const fEnd = new Date(f.scheduledAt.getTime() + f.durationMin * 60_000);
    return scheduledAt < fEnd && f.scheduledAt < windowEnd;
  });
}
