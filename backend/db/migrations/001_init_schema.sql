-- =====================================================================
-- Carp Partners TV — Migración 001: esquema inicial
-- Cubre: users, subscriptions, categories, series, videos
-- Referencia: Briefing técnico v2.0, sección 3.1
-- =====================================================================

-- Para generar UUIDs sin extensiones de pago. pgcrypto viene con PostgreSQL.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------
-- users — todos los usuarios. role = 'user' | 'admin'
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT,                       -- NULL hasta que el usuario migrado establece contraseña
    name                TEXT,
    avatar_url          TEXT,
    role                TEXT NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin')),
    stripe_customer_id  TEXT UNIQUE,
    -- Token de un solo uso para el flujo "establece tu contraseña" (migración WP)
    password_set_token  TEXT,
    password_set_expires TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- categories — Técnicas, Series, Podcast, etc.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    description  TEXT,
    cover_url    TEXT,
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- series — agrupaciones de episodios
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    description  TEXT,
    category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    season_num   INTEGER NOT NULL DEFAULT 1,
    cover_url    TEXT,
    order_index  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- videos — catálogo completo. vimeo_id = ID del vídeo en Vimeo
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    description   TEXT,
    vimeo_id      TEXT NOT NULL,
    duration_sec  INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    series_id     UUID REFERENCES series(id) ON DELETE SET NULL,
    episode_num   INTEGER,
    published     BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- subscriptions — estado REAL de la suscripción (fuente: webhooks Stripe)
-- status = active | cancelled | past_due | trialing
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_sub_id TEXT NOT NULL UNIQUE,
    plan          TEXT,                              -- 'monthly' | 'annual'
    status        TEXT NOT NULL DEFAULT 'trialing'
                      CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete')),
    period_start  TIMESTAMPTZ,
    period_end    TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- Índices (Briefing 3.2)
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_st  ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_videos_category_pub    ON videos(category_id, published);
CREATE INDEX IF NOT EXISTS idx_videos_series          ON videos(series_id, episode_num);

-- updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_videos_updated        BEFORE UPDATE ON videos        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
