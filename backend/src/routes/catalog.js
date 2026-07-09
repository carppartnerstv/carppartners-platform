// =====================================================================
// Rutas de catálogo y reproducción.  (Briefing 4.1, 4.3)
//   GET  /videos                catálogo paginado con filtros
//   GET  /videos/:id            detalle de un vídeo
//   GET  /videos/:id/stream     token/URL firmada de Vimeo (proxy seguro)
//   POST /videos/:id/rating     vota el vídeo (-1/1/2, UPSERT)
//   GET  /videos/:id/rating     valoración actual del usuario para ese vídeo
//   DELETE /videos/:id/rating   quita la valoración del usuario
//   GET  /categories            categorías con portadas
//   GET  /series                series de primer nivel (con temporadas agregadas)
//   GET  /series/:id            detalle de una serie + sus temporadas
//
// Todas exigen JWT; las de contenido exigen además suscripción activa.
// =====================================================================
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireSubscription } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { getPlaybackUrl } from '../services/vimeo.js';

export const catalogRouter = Router();

// Condición de visibilidad pública: publicado Y (sin fecha programada, o fecha ya pasada)
const VISIBLE = `v.published = true AND (v.published_at IS NULL OR v.published_at <= now())`;

// Subquery de crew reutilizable (requiere alias v para la tabla videos)
// Incluye avatar_url para poder pintar la sección "Reparto" en el detalle.
const CREW_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', cm.id, 'name', cm.name, 'slug', cm.slug, 'role', cm.role, 'avatar_url', cm.avatar_url)
            ORDER BY cm.order_index, cm.name)
       FROM video_crew vc JOIN crew_members cm ON cm.id = vc.crew_member_id
      WHERE vc.video_id = v.id),
    '[]'::json
  ) AS crew`;

// --- Catálogo paginado con filtros -----------------------------------
catalogRouter.get(
  '/videos',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? '24', 10), 100);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    const { category, series, q, crew } = req.query;

    const filters = [VISIBLE];
    const params = [];
    if (category) {
      params.push(category);
      filters.push(`v.category_id = $${params.length}`);
    }
    if (series) {
      params.push(series);
      filters.push(`v.series_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(v.title ILIKE $${params.length} OR v.description ILIKE $${params.length})`);
    }
    if (crew) {
      params.push(crew);
      filters.push(
        `EXISTS (SELECT 1 FROM video_crew vc2
                  JOIN crew_members cm2 ON cm2.id = vc2.crew_member_id
                 WHERE vc2.video_id = v.id AND cm2.slug = $${params.length})`,
      );
    }

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT v.id, v.title, v.slug, v.description, v.duration_sec, v.thumbnail_url,
              v.category_id, v.series_id, v.episode_num, v.created_at,
              ${CREW_SUBQUERY}
         FROM videos v
        WHERE ${filters.join(' AND ')}
        ORDER BY v.series_id NULLS LAST, v.episode_num NULLS LAST, v.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ videos: rows, limit, offset });
  }),
);

// --- Vídeo destacado en portada (hero de Home) ------------------------
// Registrada ANTES de /videos/:id a propósito: si fuera después, Express
// intentaría resolver "featured" como el parámetro :id.
catalogRouter.get(
  '/videos/featured',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    // 1. Vídeo marcado manualmente como destacado (si sigue visible)
    let video = await queryOne(
      `SELECT v.id, v.title, v.slug, v.description, v.duration_sec, v.thumbnail_url,
              v.category_id, v.series_id, v.episode_num, v.created_at,
              ${CREW_SUBQUERY}
         FROM videos v
        WHERE v.is_featured = true AND ${VISIBLE}
        LIMIT 1`,
    );

    // 2. Fallback si no hay ninguno marcado (o el marcado ya no es visible):
    //    mismo criterio que usaba antes el frontend — primer vídeo de la
    //    primera categoría (por order_index) que tenga contenido visible.
    if (!video) {
      video = await queryOne(
        `SELECT v.id, v.title, v.slug, v.description, v.duration_sec, v.thumbnail_url,
                v.category_id, v.series_id, v.episode_num, v.created_at,
                ${CREW_SUBQUERY}
           FROM videos v
           JOIN categories c ON c.id = v.category_id
          WHERE ${VISIBLE}
          ORDER BY c.order_index, c.name, v.series_id NULLS LAST, v.episode_num NULLS LAST, v.created_at DESC
          LIMIT 1`,
      );
    }

    res.json({ video });
  }),
);

// --- Detalle de vídeo -------------------------------------------------
catalogRouter.get(
  '/videos/:id',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const video = await queryOne(
      `SELECT v.id, v.title, v.slug, v.description, v.duration_sec, v.thumbnail_url,
              v.category_id, v.series_id, v.episode_num, v.created_at, v.published_at,
              ${CREW_SUBQUERY}
         FROM videos v
        WHERE v.id = $1 AND ${VISIBLE}`,
      [req.params.id],
    );
    if (!video) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');

    // Vídeos relacionados (misma serie o categoría), con el progreso de visionado
    // del usuario actual para poder pintar la línea de tiempo en sus tarjetas.
    const { rows: related } = await query(
      `SELECT v.id, v.title, v.slug, v.thumbnail_url, v.duration_sec, v.episode_num,
              wh.progress_sec, wh.completed
         FROM videos v
         LEFT JOIN watch_history wh ON wh.video_id = v.id AND wh.user_id = $4
        WHERE ${VISIBLE} AND v.id <> $1
          AND (v.series_id = $2 OR v.category_id = $3)
        ORDER BY v.episode_num NULLS LAST, v.created_at DESC
        LIMIT 12`,
      [video.id, video.series_id, video.category_id, req.user.id],
    );

    res.json({ video, related });
  }),
);

// --- Proxy seguro de reproducción Vimeo (Briefing 4.3) ---------------
catalogRouter.get(
  '/videos/:id/stream',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const video = await queryOne(
      `SELECT id, vimeo_id FROM videos v WHERE id = $1 AND ${VISIBLE}`,
      [req.params.id],
    );
    if (!video) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');

    // Las credenciales de Vimeo nunca salen del servidor.
    const { hlsUrl, expiresInSec } = await getPlaybackUrl(video.vimeo_id);
    res.json({ hlsUrl, expiresInSec });
  }),
);

// --- Valoraciones (diálogo "¿Qué te ha parecido?") --------------------
// rating: -1 = No es para mí · 1 = Me gusta · 2 = Me encanta
const ratingSchema = z.object({
  rating: z.union([z.literal(-1), z.literal(1), z.literal(2)], {
    errorMap: () => ({ message: 'rating debe ser -1, 1 o 2' }),
  }),
});

catalogRouter.post(
  '/videos/:id/rating',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const parsed = ratingSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Datos inválidos', 'VALIDATION');

    const video = await queryOne(`SELECT id FROM videos v WHERE id = $1 AND ${VISIBLE}`, [req.params.id]);
    if (!video) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');

    const row = await queryOne(
      `INSERT INTO video_ratings (user_id, video_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, video_id) DO UPDATE SET rating = EXCLUDED.rating
       RETURNING rating`,
      [req.user.id, req.params.id, parsed.data.rating],
    );
    res.json({ rating: row.rating });
  }),
);

catalogRouter.get(
  '/videos/:id/rating',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const row = await queryOne(
      `SELECT rating FROM video_ratings WHERE user_id = $1 AND video_id = $2`,
      [req.user.id, req.params.id],
    );
    res.json({ rating: row ? row.rating : null });
  }),
);

catalogRouter.delete(
  '/videos/:id/rating',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    await query('DELETE FROM video_ratings WHERE user_id = $1 AND video_id = $2', [req.user.id, req.params.id]);
    res.status(204).end();
  }),
);

// --- Categorías -------------------------------------------------------
catalogRouter.get(
  '/categories',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, slug, description, cover_url, order_index
         FROM categories ORDER BY order_index, name`,
    );
    res.json({ categories: rows });
  }),
);

// --- Crew (para filtros en la web/móvil) -----------------------------
catalogRouter.get(
  '/crew',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, slug, role, bio, avatar_url, order_index
         FROM crew_members ORDER BY order_index, name`,
    );
    res.json({ crew: rows });
  }),
);

// --- Series (solo de primer nivel; las temporadas quedan anidadas) ---
// Una serie con temporadas (parent_series_id IS NULL en la fila madre) se
// devuelve una sola vez aquí; episode_count suma los episodios propios MÁS
// los de todas sus temporadas, para que la portada muestre el total real.
catalogRouter.get(
  '/series',
  requireAuth,
  asyncHandler(async (req, res) => {
    const categoryFilter = req.query.category ? 'AND s.category_id = $1' : '';
    const params = req.query.category ? [req.query.category] : [];

    const { rows } = await query(
      `SELECT s.id, s.title, s.slug, s.description, s.category_id, s.season_num,
              s.cover_url, s.order_index,
              COUNT(DISTINCT ch.id)::int AS season_count,
              COUNT(DISTINCT v.id) FILTER (WHERE ${VISIBLE})::int AS episode_count
         FROM series s
         LEFT JOIN series ch ON ch.parent_series_id = s.id
         LEFT JOIN videos v  ON v.series_id = s.id OR v.series_id = ch.id
        WHERE s.parent_series_id IS NULL ${categoryFilter}
        GROUP BY s.id
        ORDER BY s.order_index, s.title`,
      params,
    );
    res.json({ series: rows });
  }),
);

// --- Detalle de una serie + sus temporadas -----------------------------
// Si `seasons` viene vacío, la serie es "plana": sus episodios se obtienen
// directamente con GET /videos?series=<id>. Si trae elementos, cada uno es
// una temporada (fila de `series` con parent_series_id = esta serie) y sus
// episodios se obtienen con GET /videos?series=<seasonId>.
catalogRouter.get(
  '/series/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const series = await queryOne(
      `SELECT id, title, slug, description, category_id, season_num,
              cover_url, order_index, parent_series_id
         FROM series WHERE id = $1`,
      [req.params.id],
    );
    if (!series) throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');

    const { rows: seasons } = await query(
      `SELECT s.id, s.title, s.slug, s.season_num, s.cover_url, s.order_index,
              COUNT(v.id) FILTER (WHERE ${VISIBLE})::int AS episode_count
         FROM series s
         LEFT JOIN videos v ON v.series_id = s.id
        WHERE s.parent_series_id = $1
        GROUP BY s.id
        ORDER BY s.season_num, s.order_index`,
      [series.id],
    );

    res.json({ series, seasons });
  }),
);
