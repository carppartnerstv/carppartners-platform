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
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { query, queryOne, withTransaction } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound, HttpError } from '../utils/errors.js';
import { stripe } from '../services/stripe.js';
import { getVideoMetadata } from '../services/vimeo.js';
import sanitizeHtml from 'sanitize-html';

// ─── Configuración de subida de imágenes de avatar ───────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREW_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/crew');
fs.mkdirSync(CREW_UPLOADS_DIR, { recursive: true });

const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_MAX_BYTES    = 5 * 1024 * 1024;

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CREW_UPLOADS_DIR),
  filename:    (_req,  file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, unique);
  },
});

const multerInstance = multer({
  storage: multerStorage,
  limits:  { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIME.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Tipo no válido. Usa JPG, PNG o WebP.', 'INVALID_TYPE'));
  },
});

// Convierte errores de multer al formato estándar de la API
function avatarUpload(req, res, next) {
  multerInstance.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Imagen demasiado grande. Máximo 5 MB.', 'FILE_TOO_LARGE'));
    }
    return next(err instanceof HttpError ? err : new HttpError(400, err.message ?? 'Error de subida', 'UPLOAD_ERROR'));
  });
}

function deleteFileIfExists(filePath) {
  fs.unlink(filePath, () => {}); // fire-and-forget; si no existe, sin error
}

// Etiquetas y atributos permitidos en el campo bio (HTML enriquecido)
const BIO_SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'a', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Fuerza rel="noopener noreferrer" en todos los enlaces externos
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
  },
};

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

// Lateral reutilizable para la última suscripción de cada usuario
const SUB_LATERAL = `LEFT JOIN LATERAL (
  SELECT plan, status, period_end FROM subscriptions
   WHERE user_id = u.id ORDER BY period_end DESC NULLS LAST LIMIT 1
) s ON true`;

// Contadores por estado (para las pestañas del panel)
adminRouter.get(
  '/users/stats',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT COALESCE(s.status, '__none__') AS status, COUNT(*)::int AS count
         FROM users u ${SUB_LATERAL}
        GROUP BY s.status`,
    );
    const counts = { active: 0, trialing: 0, past_due: 0, cancelled: 0, with_subscription: 0, total: 0 };
    for (const r of rows) {
      counts.total += r.count;
      if (r.status !== '__none__') {
        counts[r.status] = r.count;
        counts.with_subscription += r.count;
      }
    }
    res.json({ counts });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    const { status, q } = req.query;

    const filters = [];
    const params = [];

    // 'with_subscription' es un valor especial: cualquier suscripción activa/pasada
    if (status === 'with_subscription') {
      filters.push(`s.status IS NOT NULL`);
    } else if (status) {
      params.push(status);
      filters.push(`s.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // Total de coincidencias (sin paginar)
    const countRow = await queryOne(
      `SELECT COUNT(*)::int AS total FROM users u ${SUB_LATERAL} ${where}`,
      params,
    );

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.created_at,
              s.plan, s.status, s.period_end
         FROM users u ${SUB_LATERAL}
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ users: rows, limit, offset, total: countRow.total });
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

// Sincroniza video_crew: borra las relaciones actuales e inserta las nuevas.
// Llamar dentro de una transacción.
async function syncVideoCrew(client, videoId, crewMemberIds) {
  await client.query('DELETE FROM video_crew WHERE video_id = $1', [videoId]);
  if (crewMemberIds.length > 0) {
    const placeholders = crewMemberIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await client.query(
      `INSERT INTO video_crew (video_id, crew_member_id) VALUES ${placeholders}`,
      [videoId, ...crewMemberIds],
    );
  }
}

// Subquery reutilizable para obtener la crew de un vídeo como array JSON
const CREW_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', cm.id, 'name', cm.name, 'slug', cm.slug, 'role', cm.role)
            ORDER BY cm.order_index, cm.name)
       FROM video_crew vc JOIN crew_members cm ON cm.id = vc.crew_member_id
      WHERE vc.video_id = v.id),
    '[]'::json
  ) AS crew`;

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
  publishedAt: z.string().optional().refine(
    s => !s || !isNaN(Date.parse(s)),
    'publishedAt debe ser una fecha ISO 8601 válida',
  ),
  crewMemberIds: z.array(z.string().uuid()).optional(),
});

adminRouter.post(
  '/videos',
  asyncHandler(async (req, res) => {
    const parsed = videoSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const v = parsed.data;

    // Determina published_at:
    // - Si se envía explícitamente, úsalo.
    // - Si published=true sin fecha, visible de inmediato → now().
    // - Si published=false, null (se asignará cuando se publique).
    const publishedAt = v.publishedAt
      ? new Date(v.publishedAt)
      : (v.published ? new Date() : null);

    const video = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO videos
          (title, slug, description, vimeo_id, duration_sec, thumbnail_url,
           category_id, series_id, episode_num, published, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          v.title, v.slug, v.description ?? null, v.vimeoId, v.durationSec ?? 0,
          v.thumbnailUrl ?? null, v.categoryId ?? null, v.seriesId ?? null,
          v.episodeNum ?? null, v.published ?? false, publishedAt,
        ],
      );
      const created = rows[0];
      if (v.crewMemberIds?.length) {
        await syncVideoCrew(client, created.id, v.crewMemberIds);
      }
      return created;
    });

    res.status(201).json({ video });
  }),
);

// --- Editar metadatos -------------------------------------------------
adminRouter.put(
  '/videos/:id',
  asyncHandler(async (req, res) => {
    const parsed = videoSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

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

    // publishedAt: valor explícito → úsalo; published=true sin fecha → auto-asigna now() si aún es null
    const { publishedAt, crewMemberIds } = parsed.data;
    if (publishedAt !== undefined) {
      params.push(publishedAt ? new Date(publishedAt) : null);
      sets.push(`published_at = $${params.length}`);
    } else if (parsed.data.published === true) {
      sets.push(`published_at = COALESCE(published_at, now())`);
    }

    const hasMetaChanges = sets.length > 0;
    if (!hasMetaChanges && crewMemberIds === undefined) {
      throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');
    }

    const video = await withTransaction(async (client) => {
      let updated;
      if (hasMetaChanges) {
        params.push(req.params.id);
        const { rows } = await client.query(
          `UPDATE videos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
          params,
        );
        updated = rows[0];
        if (!updated) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');
      } else {
        const { rows } = await client.query(
          'SELECT * FROM videos WHERE id = $1',
          [req.params.id],
        );
        updated = rows[0];
        if (!updated) throw notFound('Vídeo no encontrado', 'VIDEO_NOT_FOUND');
      }
      if (crewMemberIds !== undefined) {
        await syncVideoCrew(client, updated.id, crewMemberIds);
      }
      return updated;
    });

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

// =====================================================================
// GET /admin/videos — lista TODOS los vídeos (incluye borradores).
// El GET /videos público exige suscripción y solo devuelve publicados;
// el panel admin necesita ver el catálogo completo.
// Filtros opcionales: published (true/false), category, series, q.
// =====================================================================
adminRouter.get(
  '/videos',
  asyncHandler(async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset ?? '0',  10), 0);
    const { published, category, series, q } = req.query;

    const filters = [];
    const params  = [];

    if (published !== undefined) {
      params.push(published === 'true');
      filters.push(`v.published = $${params.length}`);
    }
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

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countRow = await queryOne(
      `SELECT COUNT(*)::int AS total FROM videos v
         LEFT JOIN categories c ON c.id = v.category_id
         LEFT JOIN series s     ON s.id = v.series_id
        ${where}`,
      params,
    );

    params.push(limit, offset);

    const { rows } = await query(
      `SELECT v.id, v.title, v.slug, v.description, v.vimeo_id,
              v.duration_sec, v.thumbnail_url, v.category_id,
              v.series_id, v.episode_num, v.published, v.published_at,
              v.created_at, v.updated_at,
              c.name AS category_name,
              s.title AS series_title,
              CASE
                WHEN v.published = false                                       THEN 'borrador'
                WHEN v.published = true AND v.published_at IS NOT NULL
                     AND v.published_at > now()                                THEN 'programado'
                ELSE 'publicado'
              END AS status,
              ${CREW_SUBQUERY}
         FROM videos v
         LEFT JOIN categories c ON c.id = v.category_id
         LEFT JOIN series s     ON s.id = v.series_id
        ${where}
        ORDER BY v.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ videos: rows, limit, offset, total: countRow.total });
  }),
);

// =====================================================================
// CRUD de categorías
// =====================================================================
const categorySchema = z.object({
  name:        z.string().min(1),
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug solo puede contener a-z, 0-9 y guiones'),
  description: z.string().optional(),
  coverUrl:    z.string().url().optional(),
  orderIndex:  z.number().int().min(0).optional(),
});

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;

    const category = await queryOne(
      `INSERT INTO categories (name, slug, description, cover_url, order_index)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [d.name, d.slug, d.description ?? null, d.coverUrl ?? null, d.orderIndex ?? 0],
    );
    res.status(201).json({ category });
  }),
);

adminRouter.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    const map = {
      name: 'name', slug: 'slug', description: 'description',
      coverUrl: 'cover_url', orderIndex: 'order_index',
    };
    const sets   = [];
    const params = [];
    for (const [key, col] of Object.entries(map)) {
      if (parsed.data[key] !== undefined) {
        params.push(parsed.data[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');

    params.push(req.params.id);
    const category = await queryOne(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!category) throw notFound('Categoría no encontrada', 'CATEGORY_NOT_FOUND');
    res.json({ category });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const category = await queryOne(
      `DELETE FROM categories WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!category) throw notFound('Categoría no encontrada', 'CATEGORY_NOT_FOUND');
    res.status(204).end();
  }),
);

// =====================================================================
// CRUD de series
// =====================================================================
const seriesSchema = z.object({
  title:       z.string().min(1),
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug solo puede contener a-z, 0-9 y guiones'),
  description: z.string().optional(),
  categoryId:  z.string().uuid().optional(),
  seasonNum:   z.number().int().min(1).optional(),
  coverUrl:    z.string().url().optional(),
  orderIndex:  z.number().int().min(0).optional(),
});

adminRouter.post(
  '/series',
  asyncHandler(async (req, res) => {
    const parsed = seriesSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;

    const series = await queryOne(
      `INSERT INTO series (title, slug, description, category_id, season_num, cover_url, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        d.title, d.slug, d.description ?? null, d.categoryId ?? null,
        d.seasonNum ?? 1, d.coverUrl ?? null, d.orderIndex ?? 0,
      ],
    );
    res.status(201).json({ series });
  }),
);

adminRouter.put(
  '/series/:id',
  asyncHandler(async (req, res) => {
    const parsed = seriesSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    const map = {
      title: 'title', slug: 'slug', description: 'description',
      categoryId: 'category_id', seasonNum: 'season_num',
      coverUrl: 'cover_url', orderIndex: 'order_index',
    };
    const sets   = [];
    const params = [];
    for (const [key, col] of Object.entries(map)) {
      if (parsed.data[key] !== undefined) {
        params.push(parsed.data[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');

    params.push(req.params.id);
    const series = await queryOne(
      `UPDATE series SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!series) throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');
    res.json({ series });
  }),
);

adminRouter.delete(
  '/series/:id',
  asyncHandler(async (req, res) => {
    const series = await queryOne(
      `DELETE FROM series WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!series) throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');
    res.status(204).end();
  }),
);

// =====================================================================
// CRUD de crew_members
// =====================================================================
const crewSchema = z.object({
  name:       z.string().min(1),
  slug:       z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug solo puede contener a-z, 0-9 y guiones'),
  role:       z.enum(['socio', 'crew']).default('crew'),
  bio:        z.string().optional(),
  avatarUrl:  z.string().url().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

adminRouter.get(
  '/crew',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, slug, role, bio, avatar_url, order_index, created_at
         FROM crew_members ORDER BY order_index, name`,
    );
    res.json({ crew: rows });
  }),
);

adminRouter.post(
  '/crew',
  asyncHandler(async (req, res) => {
    const parsed = crewSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;
    const safeBio = d.bio ? sanitizeHtml(d.bio, BIO_SANITIZE_OPTIONS) : null;
    const member = await queryOne(
      `INSERT INTO crew_members (name, slug, role, bio, avatar_url, order_index)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [d.name, d.slug, d.role, safeBio, d.avatarUrl ?? null, d.orderIndex ?? 0],
    );
    res.status(201).json({ member });
  }),
);

adminRouter.put(
  '/crew/:id',
  asyncHandler(async (req, res) => {
    const parsed = crewSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    // Sanitiza el HTML de bio antes de mapear los campos
    if (parsed.data.bio !== undefined) {
      parsed.data.bio = parsed.data.bio
        ? sanitizeHtml(parsed.data.bio, BIO_SANITIZE_OPTIONS)
        : '';
    }

    const map = {
      name: 'name', slug: 'slug', role: 'role', bio: 'bio',
      avatarUrl: 'avatar_url', orderIndex: 'order_index',
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
    const member = await queryOne(
      `UPDATE crew_members SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!member) throw notFound('Miembro no encontrado', 'CREW_NOT_FOUND');
    res.json({ member });
  }),
);

adminRouter.delete(
  '/crew/:id',
  asyncHandler(async (req, res) => {
    const member = await queryOne(
      `DELETE FROM crew_members WHERE id = $1 RETURNING id, avatar_url`,
      [req.params.id],
    );
    if (!member) throw notFound('Miembro no encontrado', 'CREW_NOT_FOUND');
    // Borra el archivo del disco si era una imagen local
    if (member.avatar_url) {
      const filename = path.basename(member.avatar_url);
      deleteFileIfExists(path.join(CREW_UPLOADS_DIR, filename));
    }
    res.status(204).end();
  }),
);

// POST /admin/crew/:id/avatar — sube o reemplaza la imagen de perfil
adminRouter.post(
  '/crew/:id/avatar',
  avatarUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No se recibió ninguna imagen', 'NO_FILE');

    const current = await queryOne(
      'SELECT id, avatar_url FROM crew_members WHERE id = $1',
      [req.params.id],
    );
    if (!current) {
      deleteFileIfExists(req.file.path); // limpia el archivo recién subido
      throw notFound('Miembro no encontrado', 'CREW_NOT_FOUND');
    }

    // Borra el archivo anterior si era una imagen local
    if (current.avatar_url) {
      const oldFilename = path.basename(current.avatar_url);
      deleteFileIfExists(path.join(CREW_UPLOADS_DIR, oldFilename));
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/crew/${req.file.filename}`;
    const member = await queryOne(
      'UPDATE crew_members SET avatar_url = $1 WHERE id = $2 RETURNING *',
      [avatarUrl, req.params.id],
    );
    res.json({ member });
  }),
);

// DELETE /admin/crew/:id/avatar — elimina la imagen de perfil
adminRouter.delete(
  '/crew/:id/avatar',
  asyncHandler(async (req, res) => {
    const current = await queryOne(
      'SELECT id, avatar_url FROM crew_members WHERE id = $1',
      [req.params.id],
    );
    if (!current) throw notFound('Miembro no encontrado', 'CREW_NOT_FOUND');

    if (current.avatar_url) {
      const filename = path.basename(current.avatar_url);
      deleteFileIfExists(path.join(CREW_UPLOADS_DIR, filename));
    }
    await queryOne(
      'UPDATE crew_members SET avatar_url = NULL WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    res.status(204).end();
  }),
);

// =====================================================================
// GET /admin/vimeo/:vimeoId/metadata — Autorelleno de metadatos desde Vimeo.
// Llama a la API de Vimeo (con el token ya configurado) y devuelve título,
// duración y thumbnail para pre-rellenar el formulario del panel sin exponer
// las credenciales al cliente.
// =====================================================================
adminRouter.get(
  '/vimeo/:vimeoId/metadata',
  asyncHandler(async (req, res) => {
    const { vimeoId } = req.params;
    if (!/^\d+$/.test(vimeoId)) {
      throw badRequest('El ID de Vimeo debe ser numérico', 'INVALID_VIMEO_ID');
    }
    try {
      const metadata = await getVideoMetadata(vimeoId);
      res.json(metadata);
    } catch (err) {
      // Re-lanzamos HttpError propios (404 de VIMEO_NOT_FOUND); el resto los
      // convertimos en un error legible sin exponer el detalle interno de Vimeo.
      if (err instanceof HttpError) throw err;
      if (err.status === 404) throw notFound('Vídeo no encontrado en Vimeo', 'VIMEO_NOT_FOUND');
      throw badRequest(
        `No se pudieron obtener los metadatos de Vimeo: ${err.message}`,
        'VIMEO_ERROR',
      );
    }
  }),
);
