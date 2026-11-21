# Bridal Rental Manager

A full-stack web app for managing a bridal gown & formal suit rental
business: an interactive catalog, a fitting schedule with overlap
protection, an automatic package calculator, an admin dashboard, and —
the heart of the app — a handover inspection flow with deposit escrow
that settles "the stain was already there" disputes with timestamped
photo evidence.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** + **PostgreSQL**
- No paid services. Everything runs locally.

## Features

1. **Interactive catalog** (`/`) — gowns, suits and accessories with
   filters for size, style, price range and availability for a rental
   window, plus detail pages (`/items/[id]`) with booking and fitting
   forms.
2. **Fitting schedule** (`/fittings`) — book fitting appointments,
   grouped by day; the same item cannot have two fittings at the same
   time.
3. **Package calculator** (`/calculator`) — bundle pricing with package
   discounts, a 5% "complete look" bonus (gown + suit + accessory),
   and a 25% total-discount cap, all itemised live.
4. **Admin dashboard** (`/admin`) — bookings overview, upcoming
   fittings, revenue summary, items out on rent, and open escrows.
5. **Handover inspection & deposit escrow** — see below.

## Setup

Prerequisites: Node.js 18+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (Docker example) and point the app at it
docker run --name bridal-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bridal_rental -p 5432:5432 -d postgres:16
cp .env.example .env

# 3. Create the tables (either way works — they are kept in sync)
npx prisma migrate dev --name init
# ...or apply the plain-SQL migration directly:
# psql "$DATABASE_URL" -f db/migrations/001_init.sql

# 4. Seed realistic data (gowns, suits, packages, one dispute booking)
npm run db:seed

# 5. Run it
npm run dev
# → http://localhost:3000
```

Other useful commands:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run demo:dispute # run the escrow dispute flow without a database
```

## Architecture

```
src/
  app/
    page.tsx              Catalog (filters + availability)
    items/[id]/page.tsx   Item detail, booking & fitting forms
    fittings/page.tsx     Fitting schedule, grouped by day
    calculator/page.tsx   Package calculator (client component)
    admin/page.tsx        Admin dashboard
    api/
      items/route.ts      GET items (filters + availability)
      packages/route.ts   GET packages with items
      bookings/route.ts   GET + POST bookings (overlap-checked)
      fittings/route.ts   GET + POST fittings (overlap-checked)
      inspections/route.ts GET + POST handover inspections
      escrow/[bookingId]/route.ts  GET preview + POST resolve
  components/
    BookingForm.tsx       Rental booking form
    FittingForm.tsx       Fitting booking form
  lib/
    prisma.ts             Singleton Prisma client
    pricing.ts            Bundle pricing (pure, client-safe)
    availability.ts       Overlap checks for bookings & fittings
    escrow.ts             Inspection comparison + escrow resolution
prisma/
  schema.prisma           Prisma schema (PostgreSQL)
  seed.ts                 Seed data incl. the sample dispute
db/migrations/001_init.sql  Plain-SQL twin of the schema, with CHECK
                            constraints (e.g. condition_score 1–5)
scripts/demo-dispute.ts   Runnable dispute demo (no DB needed)
```

Money is integer cents everywhere. Rental dates are half-open
`[start, end)` ranges: a gown returned on the 16th can go out again on
the 16th.

## The dispute flow: handover inspection & deposit escrow

This is the feature the whole app is built around. A rental deposit
sits in escrow until the garment passes its post-return inspection,
and every claim is decided by comparing two timestamped photo records
— not by memory.

### Data model

- **`handover_inspections`** — one row per inspection event:
  `id`, `booking_id`, `photo_url`, `taken_at` (TIMESTAMPTZ, defaults
  to `now()`), `inspector_id`, `condition_score` (1–5, enforced by a
  CHECK constraint), plus `kind` (`PRE_RENTAL` / `POST_RETURN`) so the
  two inspections of one booking can be told apart.
- **`defect_map`** — every flaw found during an inspection:
  `id`, `inspection_id`, `zone` (e.g. `skirt`, `bodice`, `hem`),
  `defect_type` (e.g. `stain`, `scuff`, `tear`), `photo_url`.
- **`deposit_escrow`** — the deposit for a booking:
  `booking_id` (PK), `amount_cents`, `status`
  (`held` / `released` / `disputed` / `forfeited`), `released_at`.

### How a dispute is decided

1. **At handover** the inspector photographs the garment and maps every
   pre-existing flaw into `defect_map`. The deposit goes into escrow
   (`held`).
2. **At return** a second inspection records the condition again, with
   its own photos.
3. `compareInspections()` (`src/lib/escrow.ts`) diffs the two defect
   maps. A flaw in the post-return map that is **not** in the
   pre-rental map (same zone + same defect type) is new damage.
4. The recommendation follows from what is new:
   - **Nothing new, condition not worse → RELEASE** the deposit.
   - **New minor flaws** (scuff, loose thread) → **HOLD**: escrow
     becomes `disputed` and a human reviews the photos before any
     money moves.
   - **New severe damage** (stain, tear, burn, missing part, broken
     zipper) or a condition-score drop of 2+ → **FORFEIT**: the shop
     keeps the deposit to cover the damage.
5. `POST /api/escrow/<bookingId>` runs the same logic against the
   database and persists the resulting status. `GET` on the same route
   previews the recommendation without changing anything.

### Worked example: red wine on a $5,000 gown

The seed data (`npm run db:seed`) writes exactly this case:

- **Aurelia Silk Gown** — value $5,000, rental $1,250, deposit $1,500.
- **Pre-rental inspection** (14 Nov, 09:00): condition **5/5**. One
  pre-existing flaw mapped: a small `scuff` on the `hem`, photographed.
- **Post-return inspection** (16 Nov, 18:30): condition **2/5**. The
  hem scuff is still there — and there is a **new red-wine `stain` on
  the `skirt`** that was not on the pre-rental map.
- The client claims the stain was already there. The comparison says
  otherwise: the stain is new, it is severe, and the condition score
  fell by 3. **Recommendation: FORFEIT** — the $1,500 deposit is kept,
  with the timestamped before/after photos attached as evidence. The
  pre-existing hem scuff is correctly ignored.

Try it yourself (no database needed):

```bash
npm run demo:dispute
```

Or, with the database seeded, resolve it for real:

```bash
# preview (does not change anything)
curl http://localhost:3000/api/escrow/<bookingId>
# resolve (persists FORFEITED)
curl -X POST http://localhost:3000/api/escrow/<bookingId>
```

(The seed script prints the sample booking id.)

## API summary

| Route | Method | Description |
|---|---|---|
| `/api/items` | GET | List items; `?type=&size=&style=&minPrice=&maxPrice=&q=&from=&to=` |
| `/api/packages` | GET | Packages with their items |
| `/api/bookings` | GET / POST | List / create bookings (409 on overlap) |
| `/api/fittings` | GET / POST | List / create fittings (409 on overlap) |
| `/api/inspections` | GET / POST | List / record inspections + defect maps |
| `/api/escrow/[bookingId]` | GET / POST | Preview / resolve the deposit escrow |

## Notes & limits

- Photo URLs in the seed data are placeholders (`example.com`). In
  production, upload inspection photos to object storage (S3, R2, or
  Supabase Storage) and store the resulting URLs.
- Authentication is intentionally out of scope for this MVP skeleton:
  the admin dashboard and the inspection endpoints are unauthenticated.
  Add auth (e.g. NextAuth) before putting real customer data behind
  them.
- Overlap protection is enforced in the application layer
  (`src/lib/availability.ts`) and by an index on
  `(item_id, start_date, end_date)`; for hard guarantees under
  concurrent writes, add a Postgres exclusion constraint on the
  booking range.
