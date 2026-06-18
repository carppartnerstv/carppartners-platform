// =====================================================================
// Rutas de catálogo y reproducción.  (Briefing 4.1, 4.3)
//   GET /videos                catálogo paginado con filtros
//   GET /videos/:id            detalle de un vídeo
//   GET /videos/:id/stream     token/URL firmada de Vimeo (proxy seguro)
//   GET /categories            categorías con portadas
//   GET /series                series con episodios
//
// Todas exigen JWT; las de contenido exigen además suscripción activa.
// =====================================================================
import { Router } from 'express';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireSubscription } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { getPlaybackUrl } from '../services/vimeo.js';

export const catalogRouter = Router();

// Condición de visibilidad pública: publicado Y (sin fecha programada, o fecha ya pasada)
const VISIBLE = `v.published = true AND (v.published_at IS NULL OR v.published_at <= now())`;

// Subquery de crew reutilizable (requiere alias v para la tabla videos)
const CREW_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', cm.id, 'name', cm.name, 'slug', cm.slug, 'role', cm.role)
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

    // Vídeos relacionados (misma serie o categoría)
    const { rows: related } = await query(
      `SELECT id, title, slug, thumbnail_url, duration_sec, episode_num
         FROM videos v
        WHERE ${VISIBLE} AND id <> $1
          AND (series_id = $2 OR category_id = $3)
        ORDER BY episode_num NULLS LAST, created_at DESC
        LIMIT 12`,
      [video.id, video.series_id, video.category_id],
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

// --- Series (con sus episodios publicados) ---------------------------
catalogRouter.get(
  '/series',
  requireAuth,
  asyncHandler(async (req, res) => {
    const categoryFilter = req.query.category ? 'AND s.category_id = $1' : '';
    const params = req.query.category ? [req.query.category] : [];

    const { rows } = await query(
      `SELECT s.id, s.title, s.slug, s.description, s.category_id, s.season_num,
              s.cover_url, s.order_index,
              COUNT(v.id) FILTER (WHERE v.published) AS episode_count
         FROM series s
         LEFT JOIN videos v ON v.series_id = s.id
        WHERE 1 = 1 ${categoryFilter}
        GROUP BY s.id
        ORDER BY s.order_index, s.title`,
      params,
    );
    res.json({ series: rows });
  }),
);
