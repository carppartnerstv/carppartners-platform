-- =====================================================================
-- Carp Partners TV — Migración 006: updated_at en video_ratings
-- Registra cuándo el usuario cambió su voto. Mismo patrón set_updated_at
-- (función creada en 001_init_schema.sql) que users/subscriptions/videos.
-- =====================================================================

ALTER TABLE video_ratings
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER trg_video_ratings_updated
    BEFORE UPDATE ON video_ratings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
