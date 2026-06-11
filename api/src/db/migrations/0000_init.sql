-- =============================================================================
-- 0000_init.sql — FS25 Farm Planner initial schema (H2.2, SQL custom)
--
-- Hand-authored translation of docs/base-de-datos.md. This file is the source
-- of truth applied at runtime by src/db/migrate.ts (NOT drizzle-kit's journal).
--
-- Order: (a) extension, (b) enums, (c) tables (no inline FKs), (d) FK/UNIQUE/
-- CHECK constraints, (e) indexes, (f) set_updated_at() + BEFORE UPDATE triggers.
-- Requires PostgreSQL 18 for native uuidv7().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (a) Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- (b) Enums (idempotent: ignore if already created)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE difficulty AS ENUM ('easy', 'normal', 'hard');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sell_price_type AS ENUM ('baseline', 'max_seasonal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE animal_species AS ENUM ('cow', 'buffalo', 'chicken', 'sheep', 'goat', 'pig', 'horse');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -----------------------------------------------------------------------------
-- (c) Tables — no inline FKs (FKs added in section (d) to avoid ordering issues)
-- -----------------------------------------------------------------------------

-- 1. users
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    email         citext NOT NULL,
    password_hash text NOT NULL,
    display_name  varchar(100),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. refresh_tokens
CREATE TABLE refresh_tokens (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id        uuid NOT NULL,
    token_hash     text NOT NULL,
    expires_at     timestamptz NOT NULL,
    revoked_at     timestamptz,
    replaced_by_id uuid,
    user_agent     text,
    ip             inet,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. user_settings (PK = user_id, 1:1 with users)
CREATE TABLE user_settings (
    user_id        uuid PRIMARY KEY,
    locale         varchar(10) NOT NULL DEFAULT 'es',
    theme          varchar(20) NOT NULL DEFAULT 'system',
    active_farm_id uuid,
    preferences    jsonb NOT NULL DEFAULT '{}',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. game_versions
CREATE TABLE game_versions (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    label       varchar(50) NOT NULL,
    is_active   boolean NOT NULL DEFAULT false,
    released_at date,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. crops
CREATE TABLE crops (
    id               uuid PRIMARY KEY DEFAULT uuidv7(),
    game_version_id  uuid NOT NULL,
    slug             varchar(50) NOT NULL,
    name_es          varchar(100) NOT NULL,
    name_en          varchar(100) NOT NULL,
    yield_per_m2     numeric(10,4) NOT NULL,
    base_price       numeric(10,4) NOT NULL,
    max_price_factor numeric(6,3)  NOT NULL,
    seed_rate        numeric(12,6) NOT NULL,
    weight_per_liter numeric(6,3)  NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 6. silage_crops
CREATE TABLE silage_crops (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    game_version_id uuid NOT NULL,
    crop_id         uuid NOT NULL,
    yield_per_m2    numeric(10,4) NOT NULL,
    chaff_factor    numeric(6,3)  NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 7. animal_types
CREATE TABLE animal_types (
    id                        uuid PRIMARY KEY DEFAULT uuidv7(),
    game_version_id           uuid NOT NULL,
    species                   animal_species NOT NULL,
    name_es                   varchar(100) NOT NULL,
    difficulty_scalar_easy    numeric(6,3) NOT NULL DEFAULT 3.0,
    difficulty_scalar_normal  numeric(6,3) NOT NULL DEFAULT 1.8,
    difficulty_scalar_hard    numeric(6,3) NOT NULL DEFAULT 1.0,
    sale_price                numeric(12,2),
    product_slug              varchar(50),
    product_base_price        numeric(10,4),
    product_price_scalar      numeric(8,4),
    monthly_rates             jsonb NOT NULL,
    feed_options              jsonb NOT NULL DEFAULT '{}',
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 8. game_constants
CREATE TABLE game_constants (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    game_version_id uuid NOT NULL,
    key             varchar(100) NOT NULL,
    value           jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 9. farms
CREATE TABLE farms (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id             uuid NOT NULL,
    game_version_id     uuid NOT NULL,
    name                varchar(100) NOT NULL,
    map_name            varchar(100),
    difficulty          difficulty NOT NULL DEFAULT 'normal',
    default_yield_bonus numeric(6,4) NOT NULL DEFAULT 0.4250,
    sell_price_type     sell_price_type NOT NULL DEFAULT 'baseline',
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 10. fields
CREATE TABLE fields (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    farm_id        uuid NOT NULL,
    field_number   integer NOT NULL,
    hectares       numeric(8,2) NOT NULL,
    crop_id        uuid,
    is_silage      boolean NOT NULL DEFAULT false,
    yield_bonus    numeric(6,4),
    purchase_price numeric(12,2),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 11. stables
CREATE TABLE stables (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    farm_id       uuid NOT NULL,
    name          varchar(100) NOT NULL,
    species       animal_species NOT NULL,
    max_capacity  integer NOT NULL,
    current_count integer NOT NULL DEFAULT 0,
    config        jsonb NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 12. machinery
CREATE TABLE machinery (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    farm_id           uuid NOT NULL,
    name              varchar(150) NOT NULL,
    working_width_m   numeric(6,2) NOT NULL,
    working_speed_kmh numeric(6,2) NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 13. animal_calculator_configs
CREATE TABLE animal_calculator_configs (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    farm_id        uuid NOT NULL,
    species        animal_species NOT NULL,
    schema_version smallint NOT NULL DEFAULT 1,
    inputs         jsonb NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 14. calculator_states
CREATE TABLE calculator_states (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    farm_id    uuid NOT NULL,
    tool_key   varchar(50) NOT NULL,
    state      jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- (d) Constraints — FOREIGN KEY, UNIQUE, CHECK
-- -----------------------------------------------------------------------------

-- users
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- refresh_tokens
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_replaced_by_fk
  FOREIGN KEY (replaced_by_id) REFERENCES refresh_tokens(id);

-- user_settings
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_active_farm_fk
  FOREIGN KEY (active_farm_id) REFERENCES farms(id) ON DELETE SET NULL;

-- game_versions
ALTER TABLE game_versions ADD CONSTRAINT game_versions_label_unique UNIQUE (label);

-- crops
ALTER TABLE crops ADD CONSTRAINT crops_version_slug_unique UNIQUE (game_version_id, slug);
ALTER TABLE crops ADD CONSTRAINT crops_game_version_fk
  FOREIGN KEY (game_version_id) REFERENCES game_versions(id) ON DELETE RESTRICT;
ALTER TABLE crops ADD CONSTRAINT crops_yield_positive       CHECK (yield_per_m2 > 0);
ALTER TABLE crops ADD CONSTRAINT crops_price_non_negative   CHECK (base_price >= 0);
ALTER TABLE crops ADD CONSTRAINT crops_max_factor_positive  CHECK (max_price_factor > 0);
ALTER TABLE crops ADD CONSTRAINT crops_seed_non_negative    CHECK (seed_rate >= 0);
ALTER TABLE crops ADD CONSTRAINT crops_weight_positive      CHECK (weight_per_liter > 0);

-- silage_crops
ALTER TABLE silage_crops ADD CONSTRAINT silage_crops_version_crop_unique UNIQUE (game_version_id, crop_id);
ALTER TABLE silage_crops ADD CONSTRAINT silage_crops_game_version_fk
  FOREIGN KEY (game_version_id) REFERENCES game_versions(id) ON DELETE RESTRICT;
ALTER TABLE silage_crops ADD CONSTRAINT silage_crops_crop_fk
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE;
ALTER TABLE silage_crops ADD CONSTRAINT silage_crops_yield_positive CHECK (yield_per_m2 > 0);
ALTER TABLE silage_crops ADD CONSTRAINT silage_crops_chaff_positive CHECK (chaff_factor > 0);

-- animal_types
ALTER TABLE animal_types ADD CONSTRAINT animal_types_version_species_unique UNIQUE (game_version_id, species);
ALTER TABLE animal_types ADD CONSTRAINT animal_types_game_version_fk
  FOREIGN KEY (game_version_id) REFERENCES game_versions(id) ON DELETE RESTRICT;
ALTER TABLE animal_types ADD CONSTRAINT animal_types_scalar_easy_positive   CHECK (difficulty_scalar_easy > 0);
ALTER TABLE animal_types ADD CONSTRAINT animal_types_scalar_normal_positive CHECK (difficulty_scalar_normal > 0);
ALTER TABLE animal_types ADD CONSTRAINT animal_types_scalar_hard_positive   CHECK (difficulty_scalar_hard > 0);
ALTER TABLE animal_types ADD CONSTRAINT animal_types_sale_price_non_negative CHECK (sale_price IS NULL OR sale_price >= 0);
ALTER TABLE animal_types ADD CONSTRAINT animal_types_product_price_non_negative CHECK (product_base_price IS NULL OR product_base_price >= 0);

-- game_constants
ALTER TABLE game_constants ADD CONSTRAINT game_constants_version_key_unique UNIQUE (game_version_id, key);
ALTER TABLE game_constants ADD CONSTRAINT game_constants_game_version_fk
  FOREIGN KEY (game_version_id) REFERENCES game_versions(id) ON DELETE RESTRICT;

-- farms
ALTER TABLE farms ADD CONSTRAINT farms_user_name_unique UNIQUE (user_id, name);
ALTER TABLE farms ADD CONSTRAINT farms_user_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE farms ADD CONSTRAINT farms_game_version_fk
  FOREIGN KEY (game_version_id) REFERENCES game_versions(id) ON DELETE RESTRICT;
ALTER TABLE farms ADD CONSTRAINT farms_yield_bonus_range CHECK (default_yield_bonus >= 0 AND default_yield_bonus <= 5);

-- fields
ALTER TABLE fields ADD CONSTRAINT fields_farm_number_unique UNIQUE (farm_id, field_number);
ALTER TABLE fields ADD CONSTRAINT fields_farm_fk
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE fields ADD CONSTRAINT fields_crop_fk
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE SET NULL;
ALTER TABLE fields ADD CONSTRAINT fields_number_positive   CHECK (field_number > 0);
ALTER TABLE fields ADD CONSTRAINT fields_hectares_positive CHECK (hectares > 0);
ALTER TABLE fields ADD CONSTRAINT fields_yield_bonus_range CHECK (yield_bonus IS NULL OR (yield_bonus >= 0 AND yield_bonus <= 5));
ALTER TABLE fields ADD CONSTRAINT fields_price_non_negative CHECK (purchase_price IS NULL OR purchase_price >= 0);

-- stables
ALTER TABLE stables ADD CONSTRAINT stables_farm_name_unique UNIQUE (farm_id, name);
ALTER TABLE stables ADD CONSTRAINT stables_farm_fk
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE stables ADD CONSTRAINT stables_capacity_positive    CHECK (max_capacity > 0);
ALTER TABLE stables ADD CONSTRAINT stables_count_non_negative   CHECK (current_count >= 0);
ALTER TABLE stables ADD CONSTRAINT stables_count_within_capacity CHECK (current_count <= max_capacity);

-- machinery
ALTER TABLE machinery ADD CONSTRAINT machinery_farm_fk
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE;
ALTER TABLE machinery ADD CONSTRAINT machinery_width_positive CHECK (working_width_m > 0);
ALTER TABLE machinery ADD CONSTRAINT machinery_speed_positive CHECK (working_speed_kmh > 0);

-- animal_calculator_configs
ALTER TABLE animal_calculator_configs ADD CONSTRAINT animal_configs_farm_species_unique UNIQUE (farm_id, species);
ALTER TABLE animal_calculator_configs ADD CONSTRAINT animal_configs_farm_fk
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE;

-- calculator_states
ALTER TABLE calculator_states ADD CONSTRAINT calculator_states_farm_tool_unique UNIQUE (farm_id, tool_key);
ALTER TABLE calculator_states ADD CONSTRAINT calculator_states_farm_fk
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- (e) Indexes (unique + partial unique + support)
-- -----------------------------------------------------------------------------

-- refresh_tokens
CREATE UNIQUE INDEX refresh_tokens_token_hash_unique ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- game_versions (partial unique: at most one active version)
CREATE UNIQUE INDEX one_active_game_version ON game_versions(is_active) WHERE is_active;

-- farms
CREATE INDEX idx_farms_user_id ON farms(user_id);

-- fields
CREATE INDEX idx_fields_farm_id ON fields(farm_id);
CREATE INDEX idx_fields_crop_id ON fields(crop_id);

-- stables
CREATE INDEX idx_stables_farm_id ON stables(farm_id);

-- machinery
CREATE INDEX idx_machinery_farm_id ON machinery(farm_id);

-- -----------------------------------------------------------------------------
-- (f) set_updated_at() trigger function + one BEFORE UPDATE trigger per table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_refresh_tokens
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_game_versions
  BEFORE UPDATE ON game_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_crops
  BEFORE UPDATE ON crops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_silage_crops
  BEFORE UPDATE ON silage_crops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_animal_types
  BEFORE UPDATE ON animal_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_game_constants
  BEFORE UPDATE ON game_constants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_farms
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_fields
  BEFORE UPDATE ON fields
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_stables
  BEFORE UPDATE ON stables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_machinery
  BEFORE UPDATE ON machinery
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_animal_calculator_configs
  BEFORE UPDATE ON animal_calculator_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_calculator_states
  BEFORE UPDATE ON calculator_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
