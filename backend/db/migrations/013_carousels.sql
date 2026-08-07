-- =====================================================================
-- Migración 013: carousels + carousel_images
-- Gestor admin de "Carrousels": varios carruseles de imágenes reutilizables
-- (hero de la landing, shortcode [carrousel:slug] en páginas de contenido).
-- =====================================================================

CREATE TABLE carousels (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carousel_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id UUID        NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
  image_url   TEXT        NOT NULL,
  order_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carousel_images_carousel ON carousel_images (carousel_id, order_index);
