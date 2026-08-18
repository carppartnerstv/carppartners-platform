-- Portada vertical (2:3, tipo póster) opcional, además de la horizontal
-- (cover_url/thumbnail_url) que ya existe — no se toca ese campo. Nullable:
-- mientras no se suba, el frontend usa la horizontal como fallback.
ALTER TABLE series
    ADD COLUMN IF NOT EXISTS cover_vertical_url TEXT;

ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS cover_vertical_url TEXT;
