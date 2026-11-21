-- Bridal Rental Manager — initial migration (001_init).
-- Plain-SQL twin of prisma/schema.prisma. Apply with:
--   psql "$DATABASE_URL" -f db/migrations/001_init.sql
-- or let Prisma manage it: `npx prisma migrate dev --name init`.
--
-- This file is the canonical migration: it carries the CHECK constraints
-- and indexes that Prisma cannot express (condition_score 1–5, booking
-- date order, escrow status values).

BEGIN;

CREATE TYPE item_type AS ENUM ('GOWN', 'SUIT', 'ACCESSORY');
CREATE TYPE item_status AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED');
CREATE TYPE fitting_status AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE inspection_kind AS ENUM ('PRE_RENTAL', 'POST_RETURN');
CREATE TYPE escrow_status AS ENUM ('held', 'released', 'disputed', 'forfeited');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');

CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          item_type NOT NULL,
  style         TEXT NOT NULL,
  size          TEXT NOT NULL,
  rental_cents  INT NOT NULL CHECK (rental_cents >= 0),
  value_cents   INT NOT NULL CHECK (value_cents >= 0),
  deposit_cents INT NOT NULL CHECK (deposit_cents >= 0),
  status        item_status NOT NULL DEFAULT 'AVAILABLE',
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  discount_percent INT NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE package_items (
  package_id UUID NOT NULL REFERENCES packages (id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, item_id)
);

CREATE TABLE bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers (id),
  item_id      UUID NOT NULL REFERENCES items (id),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       booking_status NOT NULL DEFAULT 'PENDING',
  total_cents  INT NOT NULL CHECK (total_cents >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE INDEX bookings_item_dates_idx ON bookings (item_id, start_date, end_date);

CREATE TABLE fitting_appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers (id),
  item_id      UUID NOT NULL REFERENCES items (id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  status       fitting_status NOT NULL DEFAULT 'SCHEDULED',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fitting_appointments_item_time_idx ON fitting_appointments (item_id, scheduled_at);

-- Handover inspections: one row per inspection event, with a timestamped
-- photo proving the garment's condition at that moment. `kind` separates
-- the pre-rental inspection from the post-return inspection so the two
-- defect maps can be compared when a dispute arises.
CREATE TABLE handover_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  kind            inspection_kind NOT NULL,
  photo_url       TEXT NOT NULL,
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  inspector_id    UUID NOT NULL,
  condition_score INT NOT NULL CHECK (condition_score BETWEEN 1 AND 5),
  notes           TEXT
);
CREATE INDEX handover_inspections_booking_idx ON handover_inspections (booking_id);

-- Defect map: every flaw found during an inspection, pinned to a garment
-- zone (e.g. 'skirt', 'bodice', 'hem') with its own close-up photo.
CREATE TABLE defect_map (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES handover_inspections (id) ON DELETE CASCADE,
  zone          TEXT NOT NULL,
  defect_type   TEXT NOT NULL,
  photo_url     TEXT NOT NULL
);
CREATE INDEX defect_map_inspection_idx ON defect_map (inspection_id);

-- Deposit escrow: the customer's deposit is held here until the garment
-- passes the post-return inspection. Status is deliberately a small
-- closed set: held -> released | disputed | forfeited.
CREATE TABLE deposit_escrow (
  booking_id   UUID PRIMARY KEY REFERENCES bookings (id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status       escrow_status NOT NULL DEFAULT 'held',
  released_at  TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  method       TEXT NOT NULL,
  status       payment_status NOT NULL DEFAULT 'PENDING',
  paid_at      TIMESTAMPTZ
);
CREATE INDEX payments_booking_idx ON payments (booking_id);

COMMIT;
