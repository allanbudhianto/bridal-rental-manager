// Demo: the handover inspection / deposit escrow dispute flow.
// Run with: npm run demo:dispute
// No database needed — this exercises the pure comparison function in
// src/lib/escrow.ts with the same data the seed script writes to the DB
// (see prisma/seed.ts), so the result matches a real resolve exactly.
//
// Scenario: a client rents the Aurelia Silk Gown (value $5,000). At
// handover the gown is pristine (5/5) except one small scuff on the hem,
// photographed and mapped. At return the condition has dropped to 2/5:
// the hem scuff is still there, but there is a NEW red-wine stain on
// the skirt that was NOT on the pre-rental defect map.

import { compareInspections } from "@/lib/escrow";

const preRental = {
  id: "demo-pre",
  bookingId: "demo-booking",
  kind: "PRE_RENTAL" as const,
  photoUrl: "https://example.com/photos/inspections/aurelia-pre-rental.jpg",
  takenAt: new Date("2026-11-14T09:00:00Z"),
  inspectorId: "inspector-ana",
  conditionScore: 5,
  notes: "Gown inspected at handover. One small scuff on the hem, photographed.",
  defects: [
    {
      id: "demo-defect-1",
      inspectionId: "demo-pre",
      zone: "hem",
      defectType: "scuff",
      photoUrl: "https://example.com/photos/defects/aurelia-hem-scuff.jpg",
    },
  ],
};

const postReturn = {
  id: "demo-post",
  bookingId: "demo-booking",
  kind: "POST_RETURN" as const,
  photoUrl: "https://example.com/photos/inspections/aurelia-post-return.jpg",
  takenAt: new Date("2026-11-16T18:30:00Z"),
  inspectorId: "inspector-ana",
  conditionScore: 2,
  notes: "Red-wine stain found on the skirt during return inspection.",
  defects: [
    {
      id: "demo-defect-2",
      inspectionId: "demo-post",
      zone: "hem",
      defectType: "scuff",
      photoUrl: "https://example.com/photos/defects/aurelia-hem-scuff-return.jpg",
    },
    {
      id: "demo-defect-3",
      inspectionId: "demo-post",
      zone: "skirt",
      defectType: "stain",
      photoUrl: "https://example.com/photos/defects/aurelia-skirt-wine-stain.jpg",
    },
  ],
};

const recommendation = compareInspections(preRental, postReturn);

console.log("=== Deposit escrow recommendation ===");
console.log(JSON.stringify(recommendation, null, 2));
console.log("");
console.log(
  `Verdict: ${recommendation.action.toUpperCase()} — the red-wine stain on the skirt ` +
    `was not on the pre-rental defect map, so the $1,500 deposit stays held ` +
    `(forfeited to cover the damage on a $5,000 gown). The pre-existing hem ` +
    `scuff is correctly ignored: it was already mapped before the rental.`
);
