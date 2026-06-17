-- =====================================================================
-- Datos de ejemplo para desarrollo local. NO se ejecuta en producción.
-- Aplicar manualmente: psql $DATABASE_URL -f db/seed.dev.sql
-- =====================================================================

-- Usuario admin de prueba (password: "admin1234", hash bcrypt cost 12)
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin@carppartners.tv',
  '$2a$12$LQ8Q1ZQ8Q1ZQ8Q1ZQ8Q1uO0000000000000000000000000000000000',  -- REEMPLAZAR por hash real
  'Admin Carp',
  'admin'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name, slug, description, order_index) VALUES
  ('Técnicas',  'tecnicas',  'Vídeos sobre técnicas de carpfishing', 1),
  ('Series',    'series',    'Series y documentales',                2),
  ('Podcast',   'podcast',   'Episodios de podcast',                 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO series (title, slug, description, season_num, order_index, category_id)
SELECT 'Sesiones de Invierno', 'sesiones-invierno', 'Pesca en aguas frías', 1, 1, c.id
FROM categories c WHERE c.slug = 'series'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO videos (title, slug, description, vimeo_id, duration_sec, published, category_id, series_id, episode_num)
SELECT
  'Episodio 1 — Montaje de bajos', 'ep1-montaje-bajos',
  'Cómo preparar el montaje perfecto', '76979871', 1820, true,
  c.id, s.id, 1
FROM categories c, series s
WHERE c.slug = 'series' AND s.slug = 'sesiones-invierno'
ON CONFLICT (slug) DO NOTHING;
