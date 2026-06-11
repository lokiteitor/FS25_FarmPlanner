-- Migration 0001: field lifecycle status + harvest history
--
-- 1. Adds the `field_status` PostgreSQL enum ('fallow' | 'sown').
-- 2. Adds the `status` column to `fields` (default 'fallow' — all existing rows
--    keep their current state without any data change).
-- 3. Creates the `harvest_records` table to store the actual yield per harvest
--    event, with cascading deletes from both `farms` and `fields`.

-- 1. New enum type for field lifecycle state.
CREATE TYPE "field_status" AS ENUM ('fallow', 'sown');

-- 2. Add status column to fields; existing rows default to 'fallow'.
ALTER TABLE "fields"
  ADD COLUMN "status" "field_status" NOT NULL DEFAULT 'fallow';

-- 3. Harvest records table.
CREATE TABLE "harvest_records" (
  "id"                     uuid        PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "farm_id"                uuid        NOT NULL,
  "field_id"               uuid        NOT NULL,
  "crop_id"                uuid,
  "field_number"           integer     NOT NULL,
  "is_silage"              boolean     NOT NULL DEFAULT false,
  "actual_yield_liters"    numeric(14,2) NOT NULL,
  "projected_yield_liters" numeric(14,2),
  "harvested_at"           timestamptz NOT NULL DEFAULT now(),
  "created_at"             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "harvest_records_yield_non_negative"
    CHECK ("actual_yield_liters" >= 0)
);

-- Foreign keys
ALTER TABLE "harvest_records"
  ADD CONSTRAINT "harvest_records_farm_id_fk"
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;

ALTER TABLE "harvest_records"
  ADD CONSTRAINT "harvest_records_field_id_fk"
    FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE;

ALTER TABLE "harvest_records"
  ADD CONSTRAINT "harvest_records_crop_id_fk"
    FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX "idx_harvest_records_farm_id"  ON "harvest_records" ("farm_id");
CREATE INDEX "idx_harvest_records_field_id" ON "harvest_records" ("field_id");
