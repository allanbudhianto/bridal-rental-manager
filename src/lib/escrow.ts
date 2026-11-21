// Handover inspection & deposit escrow — the dispute engine.
//
// How it works:
// 1. At handover, the inspector photographs the garment and records every
//    pre-existing flaw in the defect map (zone + defect type + close-up
//    photo), with a timestamp. The deposit goes into escrow (HELD).
// 2. At return, a second inspection records the garment's condition again.
// 3. `compareInspections` diffs the two defect maps. A flaw that appears
//    in the post-return map but NOT in the pre-rental map is new damage.
// 4. The recommendation follows from what is new:
//      - nothing new, condition not worse  -> RELEASE the deposit
//      - new minor flaws (scuff, loose thread) -> HOLD: mark DISPUTED,
//        a human reviews the photos before any money moves
//      - new severe damage (stain, tear, burn, missing part, broken
//        zipper) or a condition-score drop of 2+ -> FORFEIT: the shop
//        keeps the deposit to cover the damage
// 5. `resolveEscrow` runs the whole flow against the database and writes
//    the resulting escrow status. It never releases money on its own
//    judgement alone for severe damage — it records FORFEITED, and the
//    actual refund/charge stays a separate, auditable step.

import { prisma } from "./prisma";
import type {
  DefectMap,
  DepositEscrow,
  EscrowStatus,
  HandoverInspection,
} from "@prisma/client";

export type InspectionWithDefects = HandoverInspection & {
  defects: DefectMap[];
};

export type EscrowAction = "release" | "hold" | "forfeit";

export type NewDefectEvidence = {
  zone: string;
  defectType: string;
  postPhotoUrl: string;
  postTakenAt: string;
};

export type EscrowRecommendation = {
  action: EscrowAction;
  reason: string;
  newDefects: NewDefectEvidence[];
  preExistingDefectsMatched: number;
  conditionScoreBefore: number;
  conditionScoreAfter: number;
  conditionScoreDrop: number;
};

/** Defect types that count as severe damage when they are new. */
export const SEVERE_DEFECT_TYPES = [
  "stain",
  "tear",
  "burn",
  "missing_part",
  "broken_zipper",
] as const;

/** Minor flaws that only ever trigger a hold for human review. */
export const MINOR_DEFECT_TYPES = ["scuff", "loose_thread", "wrinkle"] as const;

function defectKey(zone: string, defectType: string): string {
  return `${zone.trim().toLowerCase()}|${defectType.trim().toLowerCase()}`;
}

/**
 * Compare a pre-rental inspection with a post-return inspection and
 * recommend what should happen to the deposit held in escrow.
 * Pure function — no database access, easy to unit test or demo.
 */
export function compareInspections(
  pre: InspectionWithDefects,
  post: InspectionWithDefects
): EscrowRecommendation {
  const preKeys = new Set(
    pre.defects.map((d) => defectKey(d.zone, d.defectType))
  );

  const newDefects: NewDefectEvidence[] = [];
  let preExistingDefectsMatched = 0;
  for (const defect of post.defects) {
    if (preKeys.has(defectKey(defect.zone, defect.defectType))) {
      preExistingDefectsMatched += 1;
    } else {
      newDefects.push({
        zone: defect.zone,
        defectType: defect.defectType,
        postPhotoUrl: defect.photoUrl,
        postTakenAt: post.takenAt.toISOString(),
      });
    }
  }

  const conditionScoreDrop = pre.conditionScore - post.conditionScore;
  const severeNew = newDefects.filter((d) =>
    (SEVERE_DEFECT_TYPES as readonly string[]).includes(
      d.defectType.toLowerCase()
    )
  );

  if (newDefects.length === 0 && conditionScoreDrop <= 0) {
    return {
      action: "release",
      reason:
        "No new defects vs the pre-rental inspection and the condition score did not drop. Deposit can be released.",
      newDefects,
      preExistingDefectsMatched,
      conditionScoreBefore: pre.conditionScore,
      conditionScoreAfter: post.conditionScore,
      conditionScoreDrop,
    };
  }

  if (severeNew.length > 0 || conditionScoreDrop >= 2) {
    const severeList = severeNew
      .map((d) => `${d.defectType} on ${d.zone}`)
      .join(", ");
    return {
      action: "forfeit",
      reason:
        severeNew.length > 0
          ? `New severe damage found that was not on the pre-rental defect map: ${severeList}. Deposit is forfeited to cover the damage.`
          : `Condition score fell by ${conditionScoreDrop} points (from ${pre.conditionScore} to ${post.conditionScore}) with new defects present. Deposit is forfeited.`,
      newDefects,
      preExistingDefectsMatched,
      conditionScoreBefore: pre.conditionScore,
      conditionScoreAfter: post.conditionScore,
      conditionScoreDrop,
    };
  }

  return {
    action: "hold",
    reason: `New minor defect(s) found (${newDefects
      .map((d) => `${d.defectType} on ${d.zone}`)
      .join(", ")}). Deposit stays held as a dispute until a human reviews the timestamped photos.`,
    newDefects,
    preExistingDefectsMatched,
    conditionScoreBefore: pre.conditionScore,
    conditionScoreAfter: post.conditionScore,
    conditionScoreDrop,
  };
}

const ACTION_TO_STATUS: Record<EscrowAction, EscrowStatus> = {
  release: "RELEASED",
  hold: "DISPUTED",
  forfeit: "FORFEITED",
};

/**
 * Resolve a booking's escrow for real: load both inspections and the
 * escrow row, run the comparison, and persist the resulting status.
 * Throws when the booking, either inspection, or the escrow row is
 * missing, or when the escrow was already resolved.
 */
export async function resolveEscrow(bookingId: string): Promise<{
  recommendation: EscrowRecommendation;
  escrow: DepositEscrow;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      inspections: { include: { defects: true } },
      escrow: true,
    },
  });
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);
  if (!booking.escrow) throw new Error(`No escrow row for booking: ${bookingId}`);
  if (booking.escrow.status !== "HELD") {
    throw new Error(
      `Escrow for booking ${bookingId} was already resolved (status: ${booking.escrow.status}).`
    );
  }

  const pre = booking.inspections.find((i) => i.kind === "PRE_RENTAL");
  const post = booking.inspections.find((i) => i.kind === "POST_RETURN");
  if (!pre) throw new Error(`No pre-rental inspection for booking: ${bookingId}`);
  if (!post) throw new Error(`No post-return inspection for booking: ${bookingId}`);

  const recommendation = compareInspections(pre, post);
  const escrow = await prisma.depositEscrow.update({
    where: { bookingId },
    data: {
      status: ACTION_TO_STATUS[recommendation.action],
      releasedAt:
        recommendation.action === "release" ? new Date() : undefined,
    },
  });
  return { recommendation, escrow };
}
