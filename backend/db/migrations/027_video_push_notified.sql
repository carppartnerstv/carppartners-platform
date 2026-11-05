-- Evita reenviar la notificación push de "nuevo vídeo" en cada edición
-- posterior del mismo vídeo publicado — se marca la primera vez que se
-- envía y no se vuelve a tocar.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS push_notified_at TIMESTAMPTZ;
