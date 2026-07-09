-- =====================================================================
-- Carp Partners TV — Migración 007: vídeo destacado en portada (hero)
-- Cubre: videos.is_featured — selección manual del hero de Home, en vez
-- del criterio automático (primera categoría · primer vídeo).
-- =====================================================================

ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Refuerza a nivel de BD que solo puede haber un vídeo destacado a la vez
-- (el backend ya desmarca los demás al marcar uno nuevo; este índice es
-- una red de seguridad adicional ante cualquier escritura directa).
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_featured_unique
    ON videos (is_featured)
    WHERE is_featured = true;
