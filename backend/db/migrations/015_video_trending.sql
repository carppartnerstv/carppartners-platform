-- =====================================================================
-- Carp Partners TV — Migración 015: vídeos "en tendencia" para la fila de
-- Home "Tendencias en Carp Partners".
-- Cubre: videos.is_trending — mismo patrón que series.is_curated (014):
-- marcado manual desde el panel, pueden estar varios a la vez, sin índice
-- de unicidad (a diferencia de videos.is_featured, que sí es único).
-- =====================================================================

ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT false;
