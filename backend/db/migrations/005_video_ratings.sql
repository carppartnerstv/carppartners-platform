-- =====================================================================
-- Carp Partners TV — Migración 005: valoraciones de vídeo
-- Cubre: video_ratings (diálogo "¿Qué te ha parecido?" del detalle)
-- rating: -1 = No es para mí · 1 = Me gusta · 2 = Me encanta
-- =====================================================================

CREATE TABLE IF NOT EXISTS video_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating IN (-1, 1, 2)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Una única valoración por (usuario, vídeo): se hace UPSERT si revota
    UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_ratings_video ON video_ratings(video_id);
