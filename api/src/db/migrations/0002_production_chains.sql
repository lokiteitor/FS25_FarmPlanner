-- Migration 0002: production buildings + chains catalog
--
-- 1. Creates the `production_building_types` catalog table (types of factory
--    buildings: mill, bakery, oil_mill, sawmill, …).
-- 2. Creates the `production_products` catalog table (manufactured goods and
--    raw materials that are not crops: flour, oil, bread, planks, wood, etc.).
-- 3. Creates the `production_chains` catalog table (recipes: inputs/outputs per
--    cycle + cycles per month, versioned per game_version).
-- 4. Creates the `production_buildings` domain table (user's factory/greenhouse
--    instances in a farm, with their active recipes stored as a JSONB array).

-- 1. Production building types (catalog, versioned).
CREATE TABLE "production_building_types" (
  "id"              uuid        PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "game_version_id" uuid        NOT NULL,
  "slug"            varchar(50) NOT NULL,
  "name_es"         varchar(100) NOT NULL,
  "name_en"         varchar(100) NOT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "production_building_types_version_slug_unique"
    UNIQUE ("game_version_id", "slug")
);

ALTER TABLE "production_building_types"
  ADD CONSTRAINT "production_building_types_game_version_id_fk"
    FOREIGN KEY ("game_version_id") REFERENCES "game_versions"("id") ON DELETE RESTRICT;

-- 2. Production products (catalog, versioned).
--    Non-crop materials: intermediate products (flour, oil, fabric…) and
--    raw materials that aren't crops (wood, stone, wool…).
CREATE TABLE "production_products" (
  "id"              uuid        PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "game_version_id" uuid        NOT NULL,
  "slug"            varchar(50) NOT NULL,
  "name_es"         varchar(100) NOT NULL,
  "name_en"         varchar(100) NOT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "production_products_version_slug_unique"
    UNIQUE ("game_version_id", "slug")
);

ALTER TABLE "production_products"
  ADD CONSTRAINT "production_products_game_version_id_fk"
    FOREIGN KEY ("game_version_id") REFERENCES "game_versions"("id") ON DELETE RESTRICT;

-- 3. Production chains (catalog, versioned).
--    A recipe that belongs to a building type: how many cycles per month it
--    runs at full capacity, and what it consumes/produces per cycle.
--    inputs/outputs are JSONB arrays of { slug, quantityPerCycle }.
--    Slugs point to either crops.slug or production_products.slug (the engine
--    treats them as opaque strings; the frontend resolves display names).
CREATE TABLE "production_chains" (
  "id"                  uuid         PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "game_version_id"     uuid         NOT NULL,
  "building_type_slug"  varchar(50)  NOT NULL,
  "slug"                varchar(100) NOT NULL,
  "name_es"             varchar(150) NOT NULL,
  "name_en"             varchar(150) NOT NULL,
  "cycles_per_month"    numeric(10,2) NOT NULL,
  "inputs"              jsonb        NOT NULL DEFAULT '[]'::jsonb,
  "outputs"             jsonb        NOT NULL DEFAULT '[]'::jsonb,
  "created_at"          timestamptz  NOT NULL DEFAULT now(),
  "updated_at"          timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT "production_chains_version_slug_unique"
    UNIQUE ("game_version_id", "slug"),
  CONSTRAINT "production_chains_cycles_positive"
    CHECK ("cycles_per_month" > 0)
);

ALTER TABLE "production_chains"
  ADD CONSTRAINT "production_chains_game_version_id_fk"
    FOREIGN KEY ("game_version_id") REFERENCES "game_versions"("id") ON DELETE RESTRICT;

CREATE INDEX "idx_production_chains_version_building_type"
  ON "production_chains" ("game_version_id", "building_type_slug");

-- 4. Production buildings (domain, per farm).
--    A user's factory or greenhouse in their farm. `chains` is a JSONB array
--    of UserChain objects (validated by zod in the service layer):
--    { id, catalogChainSlug, name, isActive, cyclesPerMonth?, inputs?, outputs? }.
--    Overrides (cyclesPerMonth, inputs, outputs) override the catalog values
--    when set; null means "use the catalog default". A null catalogChainSlug
--    marks a fully custom (mod) chain with no catalog reference.
CREATE TABLE "production_buildings" (
  "id"                  uuid         PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "farm_id"             uuid         NOT NULL,
  "name"                varchar(100) NOT NULL,
  "building_type_slug"  varchar(50)  NOT NULL,
  "chains"              jsonb        NOT NULL DEFAULT '[]'::jsonb,
  "notes"               text,
  "created_at"          timestamptz  NOT NULL DEFAULT now(),
  "updated_at"          timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT "production_buildings_farm_name_unique"
    UNIQUE ("farm_id", "name")
);

ALTER TABLE "production_buildings"
  ADD CONSTRAINT "production_buildings_farm_id_fk"
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;

CREATE INDEX "idx_production_buildings_farm_id"
  ON "production_buildings" ("farm_id");
