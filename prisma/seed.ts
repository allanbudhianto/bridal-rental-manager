// Seed data for Bridal Rental Manager.
// Run with: npx prisma db seed   (or: npm run db:seed)
//
// Seeds realistic gowns (including a $5,000 gown), suits, accessories,
// two packages, and one sample booking that demonstrates the handover
// inspection / deposit escrow dispute flow end to end:
//   - pre-rental inspection: condition 5, one pre-existing scuff on the hem
//   - post-return inspection: condition 2, the same hem scuff PLUS a new
//     red-wine stain on the skirt — a defect that is NOT on the
//     pre-rental map, so the deposit stays held (see lib/escrow.ts and
//     `npm run demo:dispute`, or POST /api/escrow/<bookingId> to resolve).
//
// Photo URLs are placeholders — point them at real object storage
// (S3 / Cloudflare R2 / Supabase Storage) in production.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean in dependency order (foreign keys).
  await prisma.payment.deleteMany();
  await prisma.defectMap.deleteMany();
  await prisma.handoverInspection.deleteMany();
  await prisma.depositEscrow.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.packageItem.deleteMany();
  await prisma.package.deleteMany();
  await prisma.fittingAppointment.deleteMany();
  await prisma.item.deleteMany();
  await prisma.customer.deleteMany();

  const [aisha, daniel, maria] = await Promise.all([
    prisma.customer.create({
      data: { name: "Aisha Rahman", email: "aisha@example.com", phone: "+1-415-555-0132" },
    }),
    prisma.customer.create({
      data: { name: "Daniel Chen", email: "daniel@example.com", phone: "+1-415-555-0178" },
    }),
    prisma.customer.create({
      data: { name: "Maria Santos", email: "maria@example.com", phone: "+1-415-555-0119" },
    }),
  ]);

  const [aurelia, celeste, isla, regent, midnight, veil, tiara] = await Promise.all([
    prisma.item.create({
      data: {
        name: "Aurelia Silk Gown",
        type: "GOWN",
        style: "A-line",
        size: "M",
        rentalCents: 125000,
        valueCents: 500000,
        depositCents: 150000,
        status: "RENTED",
        description: "Ivory silk A-line gown with cathedral train. Our flagship piece.",
        imageUrl: "https://example.com/photos/items/aurelia-silk-gown.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Celeste Ball Gown",
        type: "GOWN",
        style: "Ball gown",
        size: "S",
        rentalCents: 98000,
        valueCents: 320000,
        depositCents: 100000,
        description: "Classic tulle ball gown with sweetheart neckline.",
        imageUrl: "https://example.com/photos/items/celeste-ball-gown.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Isla Mermaid Gown",
        type: "GOWN",
        style: "Mermaid",
        size: "L",
        rentalCents: 110000,
        valueCents: 380000,
        depositCents: 120000,
        description: "Fitted mermaid silhouette in crepe with lace overlay.",
        imageUrl: "https://example.com/photos/items/isla-mermaid-gown.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Regent Tuxedo",
        type: "SUIT",
        style: "Classic tuxedo",
        size: "48R",
        rentalCents: 32000,
        valueCents: 140000,
        depositCents: 40000,
        description: "Black peak-lapel tuxedo with satin stripe trousers.",
        imageUrl: "https://example.com/photos/items/regent-tuxedo.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Midnight Slim Suit",
        type: "SUIT",
        style: "Slim fit",
        size: "40R",
        rentalCents: 26000,
        valueCents: 110000,
        depositCents: 30000,
        description: "Midnight-navy slim suit, modern cut.",
        imageUrl: "https://example.com/photos/items/midnight-slim-suit.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Pearl Veil",
        type: "ACCESSORY",
        style: "Cathedral veil",
        size: "One size",
        rentalCents: 9000,
        valueCents: 35000,
        depositCents: 10000,
        description: "Cathedral-length veil with pearl edging.",
        imageUrl: "https://example.com/photos/items/pearl-veil.jpg",
      },
    }),
    prisma.item.create({
      data: {
        name: "Crystal Tiara",
        type: "ACCESSORY",
        style: "Tiara",
        size: "One size",
        rentalCents: 7000,
        valueCents: 28000,
        depositCents: 8000,
        description: "Crystal tiara, silver setting.",
        imageUrl: "https://example.com/photos/items/crystal-tiara.jpg",
      },
    }),
  ]);

  const [royal, classic] = await Promise.all([
    prisma.package.create({
      data: {
        name: "Royal Wedding Bundle",
        description: "Flagship gown + tuxedo + veil, one price.",
        discountPercent: 10,
      },
    }),
    prisma.package.create({
      data: {
        name: "Classic Pair",
        description: "Ball gown + slim suit for the couple.",
        discountPercent: 5,
      },
    }),
  ]);

  await prisma.packageItem.createMany({
    data: [
      { packageId: royal.id, itemId: aurelia.id },
      { packageId: royal.id, itemId: regent.id },
      { packageId: royal.id, itemId: veil.id },
      { packageId: classic.id, itemId: celeste.id },
      { packageId: classic.id, itemId: midnight.id },
    ],
  });

  // ---- Sample booking: the dispute flow, end to end -------------------
  const booking = await prisma.booking.create({
    data: {
      customerId: aisha.id,
      itemId: aurelia.id,
      startDate: new Date("2026-11-14"),
      endDate: new Date("2026-11-16"),
      status: "RETURNED",
      totalCents: 125000,
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amountCents: 125000,
      method: "card",
      status: "PAID",
      paidAt: new Date("2026-11-10T15:00:00Z"),
    },
  });

  // The deposit is held in escrow until the post-return inspection passes.
  await prisma.depositEscrow.create({
    data: { bookingId: booking.id, amountCents: 150000, status: "HELD" },
  });

  // Pre-rental inspection: pristine (5/5) except one small pre-existing
  // scuff on the hem, photographed and mapped.
  const pre = await prisma.handoverInspection.create({
    data: {
      bookingId: booking.id,
      kind: "PRE_RENTAL",
      photoUrl: "https://example.com/photos/inspections/aurelia-pre-rental.jpg",
      takenAt: new Date("2026-11-14T09:00:00Z"),
      inspectorId: "inspector-ana",
      conditionScore: 5,
      notes: "Gown inspected at handover. One small scuff on the hem, photographed.",
      defects: {
        create: [
          {
            zone: "hem",
            defectType: "scuff",
            photoUrl: "https://example.com/photos/defects/aurelia-hem-scuff.jpg",
          },
        ],
      },
    },
  });

  // Post-return inspection: condition dropped to 2/5. The hem scuff is
  // still there (pre-existing, not the client's fault) — but there is a
  // NEW red-wine stain on the skirt that was NOT on the pre-rental map.
  const post = await prisma.handoverInspection.create({
    data: {
      bookingId: booking.id,
      kind: "POST_RETURN",
      photoUrl: "https://example.com/photos/inspections/aurelia-post-return.jpg",
      takenAt: new Date("2026-11-16T18:30:00Z"),
      inspectorId: "inspector-ana",
      conditionScore: 2,
      notes: "Red-wine stain found on the skirt during return inspection.",
      defects: {
        create: [
          {
            zone: "hem",
            defectType: "scuff",
            photoUrl: "https://example.com/photos/defects/aurelia-hem-scuff-return.jpg",
          },
          {
            zone: "skirt",
            defectType: "stain",
            photoUrl: "https://example.com/photos/defects/aurelia-skirt-wine-stain.jpg",
          },
        ],
      },
    },
  });

  // One more booking + one upcoming fitting so the admin dashboard
  // and the fittings page have something to show.
  await prisma.booking.create({
    data: {
      customerId: daniel.id,
      itemId: regent.id,
      startDate: new Date("2026-11-28"),
      endDate: new Date("2026-11-30"),
      status: "CONFIRMED",
      totalCents: 32000,
    },
  });

  await prisma.fittingAppointment.create({
    data: {
      customerId: maria.id,
      itemId: celeste.id,
      scheduledAt: new Date("2026-11-22T14:00:00Z"),
      durationMin: 60,
      status: "SCHEDULED",
      notes: "First fitting, bring heels.",
    },
  });

  console.log("Seed complete.");
  console.log(`  Sample dispute booking: ${booking.id}`);
  console.log(`  Pre-rental inspection:  ${pre.id} (condition 5, hem scuff only)`);
  console.log(`  Post-return inspection: ${post.id} (condition 2, NEW red-wine stain on skirt)`);
  console.log("  Run `npm run demo:dispute` to see the escrow recommendation,");
  console.log("  or POST /api/escrow/<bookingId> to resolve it for real.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
