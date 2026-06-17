// =====================================================================
// Rutas del panel de administración.  (Briefing 4.1, 5.4)
// Todas exigen JWT + role = 'admin'.
//   GET    /admin/dashboard      métricas (suscriptores activos, MRR, etc.)
//   GET    /admin/users          listado de suscriptores con filtros
//   GET    /admin/payments       historial de pagos (desde Stripe)
//   POST   /admin/videos         crea vídeo en catálogo
//   PUT    /admin/videos/:id     edita metadatos
//   DELETE /admin/videos/:id     despublica
// =====================================================================
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { stripe } from '../services/stripe.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// --- Dashboard --------------------------------------------------------
adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const activeSubs = await queryOne(
      `SELECT COUNT(*)::int AS n FROM subscriptions WHERE status IN ('active','trialing')`,
    );
    const publishedVideos = await queryOne(
      `SELECT COUNT(*)::int AS n FROM videos WHERE published = true`,
    );
    const playsToday = await queryOne(
      `SELECT COUNT(*)::int AS n FROM watch_history WHERE last_watched_at >= current_date`,
    );
    // MRR aproximado: mensual 9,99 €, anual 89,99 € (7,50 €/mes equiv.)
    const mrr = await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN plan = 'monthly' THEN 9.99
                           WHEN plan = 'annual'  THEN 7.50 ELSE 0 END), 0)::numeric(10,2) AS mrr
         FROM subscriptions WHERE status IN ('active','trialing')`,
    );

    res.json({
      activeSubscribers: activeSubs.n,
      publishedVideos: publishedVideos.n,
      playsToday: playsToday.n,
      mrr: Number(mrr.mrr),
    });
  }),
);

// --- Suscriptores -----------------------------------------------------
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    const { status, q } = req.query;

    const filters = [];
    const params = [];
    if (status) {
      params.push(status);
      filters.push(`s.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.created_at,
              s.plan, s.status, s.period_end
         FROM users u
         LEFT JOIN LATERAL (
            SELECT plan, status, period_end FROM subscriptions
             WHERE user_id = u.id ORDER BY period_end DESC NULLS LAST LIMIT 1
         ) s ON true
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ users: rows, limit, offset });
  }),
);

// --- Historial de pagos (desde Stripe) -------------------------------
adminRouter.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100);
    const charges = await stripe.charges.list({ limit });
    const payments = charges.data.map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      email: c.billing_details?.email ?? null,
      refunded: c.refunded,
      created: new Date(c.created * 1000).toISOString(),
    }));
    res.json({ payments });
  }),
);

// --- Crear vídeo ------------------------------------------------------
const videoSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  vimeoId: z.string().min(1),
  durationSec: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().url().optional(),
  categoryId: z.string().uuid().optional(),
  seriesId: z.string().uuid().optional(),
  episodeNum: z.number().int().optional(),
  published: z.boolean().optional(),
});

adminRouter.post(
  '/videos',
  asyncHandler(async (req, res) => {
    const parsed = videoSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const v = parsed.data;

    const video = await queryOne(
      `INSERT INTO videos
        (title, slug, description, vimeo_id, duration_sec, thumbnail_url,
         category_id, series_id, episode_num, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        v.title, v.slug, v.description ?? null, v.vimeoId, v.durationSec ?? 0,
        v.thumbnailUrl ?? null, v.categoryId ?? null, v.seriesId ?? null,
        v.episodeNum ?? null, v.published ?? false,
      ],
    );
    res.status(201).json({ video });
  }),
);

// --- Editar metadatos -------------------------------------------------
adminRouter.put(
  '/videos/:id',
  asyncHandler(async (req, res) => {
    const parsed = videoSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    // Mapea camelCase -> snake_case y construye SET dinámico.
    const map = {
      title: 'title', slug: 'slug', description: 'description', vimeoId: 'vimeo_id',
      durationSec: 'duration_sec', thumbnailUrl: 'thumbnail_url', categoryId: 'category_id',
      seriesId: 'series_id', episodeNum: 'episode_num', published: 'published',
    };
    const sets = [];
    const params = [];
    for (const [key, col] of Object.entries(map)) {
      if (parsed.data[key] !== undefined) {
        params.push(parsed.data[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');

    params.push(req.params.id);
    const video = await queryOne(
      `UPDATE videos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!video) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');
    res.json({ video });
  }),
);

// --- Despublicar (no borra: pone published = false) ------------------
adminRouter.delete(
  '/videos/:id',
  asyncHandler(async (req, res) => {
    const video = await queryOne(
      `UPDATE videos SET published = false WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!video) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');
    res.status(204).end();
  }),
);
