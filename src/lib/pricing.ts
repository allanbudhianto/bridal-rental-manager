// Package / bundle pricing. Pure functions — no database access, so the
// calculator page can import this on the client and the API can reuse it
// on the server. All money is integer cents.

export type BundleItem = {
  id: string;
  name: string;
  type: "GOWN" | "SUIT" | "ACCESSORY";
  rentalCents: number;
};

export type PriceBreakdown = {
  lines: { itemId: string; name: string; rentalCents: number }[];
  subtotalCents: number;
  packageDiscountCents: number;
  completeLookBonusCents: number;
  totalDiscountCents: number;
  totalCents: number;
  appliedRules: string[];
};

/** Extra discount when a bundle has at least one gown, one suit and one accessory. */
export const COMPLETE_LOOK_BONUS_PERCENT = 5;
/** Total discount (package + bonuses) never exceeds this share of the subtotal. */
export const MAX_TOTAL_DISCOUNT_PERCENT = 25;

/**
 * Price a bundle of rental items.
 *
 * Rules, in order:
 * 1. Subtotal = sum of the items' rental prices.
 * 2. The package's own discount percent applies to the subtotal.
 * 3. "Complete look" bonus: +5% when the bundle contains at least one
 *    gown, one suit and one accessory.
 * 4. The total discount is capped at 25% of the subtotal.
 */
export function calculateBundlePrice(
  items: BundleItem[],
  packageDiscountPercent: number
): PriceBreakdown {
  const lines = items.map((item) => ({
    itemId: item.id,
    name: item.name,
    rentalCents: item.rentalCents,
  }));
  const subtotalCents = lines.reduce((sum, line) => sum + line.rentalCents, 0);
  const appliedRules: string[] = [];

  const packageDiscountCents = Math.round(
    (subtotalCents * packageDiscountPercent) / 100
  );
  if (packageDiscountPercent > 0) {
    appliedRules.push(`Package discount ${packageDiscountPercent}%`);
  }

  const types = new Set(items.map((item) => item.type));
  const isCompleteLook =
    types.has("GOWN") && types.has("SUIT") && types.has("ACCESSORY");
  const completeLookBonusCents = isCompleteLook
    ? Math.round((subtotalCents * COMPLETE_LOOK_BONUS_PERCENT) / 100)
    : 0;
  if (isCompleteLook) {
    appliedRules.push(
      `Complete-look bonus ${COMPLETE_LOOK_BONUS_PERCENT}% (gown + suit + accessory)`
    );
  }

  const uncappedDiscount = packageDiscountCents + completeLookBonusCents;
  const maxDiscount = Math.round(
    (subtotalCents * MAX_TOTAL_DISCOUNT_PERCENT) / 100
  );
  const totalDiscountCents = Math.min(uncappedDiscount, maxDiscount);
  if (uncappedDiscount > maxDiscount) {
    appliedRules.push(
      `Total discount capped at ${MAX_TOTAL_DISCOUNT_PERCENT}% of subtotal`
    );
  }

  return {
    lines,
    subtotalCents,
    packageDiscountCents,
    completeLookBonusCents,
    totalDiscountCents,
    totalCents: subtotalCents - totalDiscountCents,
    appliedRules,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
