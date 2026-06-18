-- =====================================================================
-- Migración 004: campo published_at en videos
-- Un vídeo es visible para suscriptores si:
--   published = true AND (published_at IS NULL OR published_at <= now())
-- NULL significa "visible en el momento de publicar" (comportamiento anterior).
-- =====================================================================

ALTER TABLE videos ADD COLUMN published_at TIMESTAMPTZ;

-- Los vídeos ya publicados mantienen su visibilidad: se les asigna
-- published_at = created_at para que sigan siendo accesibles.
UPDATE videos SET published_at = created_at WHERE published = true;

-- Índice compuesto para el filtro de visibilidad en GET /videos
CREATE INDEX idx_videos_visibility ON videos (published, published_at);
