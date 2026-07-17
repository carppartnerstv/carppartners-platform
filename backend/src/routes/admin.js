// =====================================================================
// Rutas del panel de administración.  (Briefing 4.1, 5.4)
// Todas exigen JWT + role = 'admin'.
//   GET    /admin/dashboard      métricas (suscriptores activos, MRR, etc.)
//   GET    /admin/users          listado de suscriptores con filtros
//   POST   /admin/users          alta manual de suscriptor (sin Stripe)
//   POST   /admin/users/:id/courtesy-subscription  otorga/extiende cortesía
//   GET    /admin/payments       historial de pagos (desde Stripe)
//   POST   /admin/videos         crea vídeo en catálogo
//   PUT    /admin/videos/:id     edita metadatos
//   DELETE /admin/videos/:id     despublica
// =====================================================================
import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { query, queryOne, withTransaction } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound, HttpError } from '../utils/errors.js';
import { stripe } from '../services/stripe.js';
import { getVideoMetadata } from '../services/vimeo.js';
import { sendMail } from '../services/mail.js';
import { setPasswordEmail } from '../services/mailTemplates.js';
import { config } from '../config/index.js';
import sanitizeHtml from 'sanitize-html';

// ─── Configuración de subida de imágenes (avatares de crew, portadas de series,
// imagen social de páginas de contenido) ──────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREW_UPLOADS_DIR   = path.resolve(__dirname, '../../uploads/crew');
const SERIES_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/series');
const PAGES_UPLOADS_DIR  = path.resolve(__dirname, '../../uploads/pages');
fs.mkdirSync(CREW_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(SERIES_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(PAGES_UPLOADS_DIR, { recursive: true });

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MAX_BYTES    = 5 * 1024 * 1024;

// Crea un middleware de subida de una sola imagen a `uploadsDir`, bajo el
// campo `fieldName` del formulario. Mismas reglas para cualquier imagen del
// panel (avatar de crew, portada de serie/película): JPG/PNG/WebP, máx 5 MB.
function makeImageUpload(uploadsDir, fieldName) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req,  file, cb) => {
      const ext    = path.extname(file.originalname).toLowerCase() || '.jpg';
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
      cb(null, unique);
    },
  });

  const instance = multer({
    storage,
    limits:  { fileSize: IMAGE_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
      cb(new HttpError(400, 'Tipo no válido. Usa JPG, PNG o WebP.', 'INVALID_TYPE'));
    },
  });

  // Convierte errores de multer al formato estándar de la API
  return function upload(req, res, next) {
    instance.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, 'Imagen demasiado grande. Máximo 5 MB.', 'FILE_TOO_LARGE'));
      }
      return next(err instanceof HttpError ? err : new HttpError(400, err.message ?? 'Error de subida', 'UPLOAD_ERROR'));
    });
  };
}

const avatarUpload = makeImageUpload(CREW_UPLOADS_DIR, 'avatar');
const seriesCoverUpload = makeImageUpload(SERIES_UPLOADS_DIR, 'cover');
const pageImageUpload = makeImageUpload(PAGES_UPLOADS_DIR, 'image');

function deleteFileIfExists(filePath) {
  fs.unlink(filePath, () => {}); // fire-and-forget; si no existe, sin error
}

// Etiquetas y atributos permitidos en campos de texto enriquecido (bio de
// crew, descripción de series/películas)
const RICH_TEXT_SANITIZE_OPTIONS = {
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
  SELECT plan, status, period_end, source FROM subscriptions
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
    const counts = { active: 0, trialing: 0, past_due: 0, cancelled: 0, courtesy: 0, with_subscription: 0, total: 0 };
    for (const r of rows) {
      counts.total += r.count;
      if (r.status !== '__none__') {
        counts[r.status] = r.count;
        counts.with_subscription += r.count;
      }
    }
    // Cortesía es una dimensión aparte (source, no status) — se cuenta por
    // separado en vez de agruparla con el resto.
    const courtesyRow = await queryOne(
      `SELECT COUNT(*)::int AS n FROM users u ${SUB_LATERAL} WHERE s.source = 'courtesy'`,
    );
    counts.courtesy = courtesyRow.n;
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

    // 'with_subscription' y 'courtesy' son valores especiales: no son un
    // status real, sino que filtran por otra columna (source).
    if (status === 'with_subscription') {
      filters.push(`s.status IS NOT NULL`);
    } else if (status === 'courtesy') {
      filters.push(`s.source = 'courtesy'`);
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
              s.plan, s.status, s.period_end, s.source
         FROM users u ${SUB_LATERAL}
        ${where}
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ users: rows, limit, offset, total: countRow.total });
  }),
);

// =====================================================================
// Alta manual de suscriptores + suscripciones de cortesía (sin Stripe).
// Pensado para familiares, sorteos, etc. Nunca tocan stripe_sub_id.
// =====================================================================
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  // Si se omite, el usuario queda sin password_hash y se genera un token de
  // "establece tu contraseña" (mismo flujo que la migración desde WordPress).
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
});

const SET_PASSWORD_TTL_DAYS = 14;

// POST /admin/users — crea un suscriptor manualmente (sin pasar por /auth/register).
adminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;
    const email = d.email.toLowerCase();

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) throw badRequest('Ese email ya está registrado', 'EMAIL_TAKEN');

    let passwordHash = null;
    let setPasswordToken = null;
    if (d.password) {
      passwordHash = await bcrypt.hash(d.password, 12);
    } else {
      setPasswordToken = crypto.randomBytes(32).toString('hex');
    }
    const setPasswordExpires = setPasswordToken
      ? new Date(Date.now() + SET_PASSWORD_TTL_DAYS * 86_400_000)
      : null;

    const user = await queryOne(
      `INSERT INTO users (email, name, password_hash, password_set_token, password_set_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar_url, created_at`,
      [email, d.name ?? null, passwordHash, setPasswordToken, setPasswordExpires],
    );

    if (setPasswordToken) {
      const setUrl = `${config.publicWebUrl}/set-password?token=${setPasswordToken}`;
      // No se espera: el admin ya recibe el enlace en la respuesta como respaldo,
      // así que un SMTP lento no debe retrasarla.
      sendMail({ to: user.email, ...setPasswordEmail({ name: user.name, setUrl }) });
    }

    res.status(201).json({ user, setPasswordToken });
  }),
);

// Calcula period_end a partir de exactamente una de las tres opciones.
const courtesySchema = z.object({
  durationMonths: z.number().int().min(1).max(60).optional(),
  endDate: z.string().datetime().optional(),
  indefinite: z.boolean().optional(),
}).refine(
  (d) => [d.durationMonths != null, d.endDate != null, d.indefinite === true].filter(Boolean).length === 1,
  { message: 'Indica exactamente una opción: duración en meses, fecha concreta, o indefinido' },
);

// POST /admin/users/:id/courtesy-subscription — otorga o extiende (upsert)
// la suscripción de cortesía de un usuario. Nunca crea/toca filas con
// source='stripe'; si el usuario ya tenía una cortesía previa, se actualiza
// esa misma fila en vez de acumular filas nuevas cada vez.
adminRouter.post(
  '/users/:id/courtesy-subscription',
  asyncHandler(async (req, res) => {
    const parsed = courtesySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;

    const user = await queryOne('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!user) throw notFound('Usuario no encontrado', 'USER_NOT_FOUND');

    const periodEnd = d.indefinite
      ? null
      : d.endDate
        ? new Date(d.endDate)
        : new Date(Date.now() + d.durationMonths * 30 * 86_400_000);

    const existing = await queryOne(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND source = 'courtesy' ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    );

    const subscription = existing
      ? await queryOne(
          `UPDATE subscriptions
              SET status = 'active', period_end = $1, period_start = COALESCE(period_start, now()), cancelled_at = NULL
            WHERE id = $2
            RETURNING *`,
          [periodEnd, existing.id],
        )
      : await queryOne(
          `INSERT INTO subscriptions (user_id, stripe_sub_id, source, plan, status, period_start, period_end)
           VALUES ($1, NULL, 'courtesy', 'courtesy', 'active', now(), $2)
           RETURNING *`,
          [user.id, periodEnd],
        );

    res.status(existing ? 200 : 201).json({ subscription });
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
    (SELECT json_agg(json_build_object('id', cm.id, 'name', cm.name, 'slug', cm.slug, 'role', cm.role, 'avatar_url', cm.avatar_url)
            ORDER BY cm.order_index, cm.name)
       FROM video_crew vc JOIN crew_members cm ON cm.id = vc.crew_member_id
      WHERE vc.video_id = v.id),
    '[]'::json
  ) AS crew`;

// Resumen de valoraciones de un vídeo: nº de votos por tipo + media.
// Siempre devuelve una fila (agregado sobre conjunto vacío = ceros/NULL), así
// que no hace falta el COALESCE que sí necesita CREW_SUBQUERY (json_agg).
const RATINGS_SUBQUERY = `
  (SELECT json_build_object(
      'love',  COUNT(*) FILTER (WHERE vr.rating = 2),
      'like',  COUNT(*) FILTER (WHERE vr.rating = 1),
      'down',  COUNT(*) FILTER (WHERE vr.rating = -1),
      'total', COUNT(*),
      'avg',   ROUND(AVG(vr.rating)::numeric, 2)
    )
     FROM video_ratings vr WHERE vr.video_id = v.id
  ) AS ratings`;

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
  isFeatured: z.boolean().optional(),
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
      // Solo puede haber un vídeo destacado a la vez.
      if (v.isFeatured === true) {
        await client.query('UPDATE videos SET is_featured = false WHERE is_featured = true');
      }

      const { rows } = await client.query(
        `INSERT INTO videos
          (title, slug, description, vimeo_id, duration_sec, thumbnail_url,
           category_id, series_id, episode_num, published, published_at, is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          v.title, v.slug, v.description ?? null, v.vimeoId, v.durationSec ?? 0,
          v.thumbnailUrl ?? null, v.categoryId ?? null, v.seriesId ?? null,
          v.episodeNum ?? null, v.published ?? false, publishedAt, v.isFeatured ?? false,
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
    const { publishedAt, crewMemberIds, isFeatured } = parsed.data;
    if (publishedAt !== undefined) {
      params.push(publishedAt ? new Date(publishedAt) : null);
      sets.push(`published_at = $${params.length}`);
    } else if (parsed.data.published === true) {
      sets.push(`published_at = COALESCE(published_at, now())`);
    }

    if (isFeatured !== undefined) {
      params.push(isFeatured);
      sets.push(`is_featured = $${params.length}`);
    }

    const hasMetaChanges = sets.length > 0;
    if (!hasMetaChanges && crewMemberIds === undefined) {
      throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');
    }

    const video = await withTransaction(async (client) => {
      // Solo puede haber un vídeo destacado a la vez: al marcar este,
      // desmarcamos cualquier otro que lo estuviera.
      if (isFeatured === true) {
        await client.query(
          'UPDATE videos SET is_featured = false WHERE is_featured = true AND id <> $1',
          [req.params.id],
        );
      }

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
// sort=rated ordena por nº de votos descendente (para ver qué gusta más).
// =====================================================================
adminRouter.get(
  '/videos',
  asyncHandler(async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset ?? '0',  10), 0);
    const { published, category, series, q, sort } = req.query;

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
              v.is_featured, v.created_at, v.updated_at,
              c.name AS category_name,
              s.title AS series_title,
              CASE
                WHEN v.published = false                                       THEN 'borrador'
                WHEN v.published = true AND v.published_at IS NOT NULL
                     AND v.published_at > now()                                THEN 'programado'
                ELSE 'publicado'
              END AS status,
              ${CREW_SUBQUERY},
              ${RATINGS_SUBQUERY}
         FROM videos v
         LEFT JOIN categories c ON c.id = v.category_id
         LEFT JOIN series s     ON s.id = v.series_id
        ${where}
        ORDER BY ${sort === 'rated'
          ? `(SELECT COUNT(*) FROM video_ratings vr WHERE vr.video_id = v.id) DESC, v.created_at DESC`
          : `v.created_at DESC`}
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
// Una serie puede tener una serie "padre" (parent_series_id) para modelar
// temporadas: la mayoría de series son planas (sin padre ni hijas), pero
// una serie puede agrupar varias "temporadas" que son a su vez filas de
// `series` con parent_series_id apuntando a ella. Solo se permite UN nivel
// de profundidad (una temporada no puede tener a su vez temporadas).
// =====================================================================
const seriesSchema = z.object({
  title:          z.string().min(1),
  slug:           z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug solo puede contener a-z, 0-9 y guiones'),
  description:    z.string().optional(),
  categoryId:     z.string().uuid().optional(),
  seasonNum:      z.number().int().min(1).optional(),
  coverUrl:       z.string().url().optional(),
  orderIndex:     z.number().int().min(0).optional(),
  parentSeriesId: z.string().uuid().nullable().optional(),
});

// Valida que `parentSeriesId` pueda usarse como padre de `currentSeriesId`
// (null si es una serie nueva): el padre debe existir, no ser la propia
// serie, no ser a su vez una temporada (ya tiene padre), y la serie que
// recibe el padre no debe tener ya temporadas propias (evita 2 niveles).
async function assertValidParentSeries(parentSeriesId, currentSeriesId) {
  if (!parentSeriesId) return;
  if (currentSeriesId && parentSeriesId === currentSeriesId) {
    throw badRequest('Una serie no puede ser temporada de sí misma', 'INVALID_PARENT_SERIES');
  }
  const parent = await queryOne(`SELECT id, parent_series_id FROM series WHERE id = $1`, [parentSeriesId]);
  if (!parent) throw badRequest('La serie padre indicada no existe', 'INVALID_PARENT_SERIES');
  if (parent.parent_series_id) {
    throw badRequest(
      'Solo se permite un nivel de temporadas: la serie padre no puede ser a su vez una temporada',
      'INVALID_PARENT_SERIES',
    );
  }
  if (currentSeriesId) {
    const child = await queryOne(`SELECT id FROM series WHERE parent_series_id = $1 LIMIT 1`, [currentSeriesId]);
    if (child) {
      throw badRequest(
        'Esta serie ya tiene temporadas propias y no puede convertirse en temporada de otra serie',
        'INVALID_PARENT_SERIES',
      );
    }
  }
}

// GET /admin/series — listado completo (incluye temporadas) para el panel.
// Añade season_count (nº de temporadas hijas) y parent_title para poder
// construir la UI de gestión sin peticiones adicionales.
adminRouter.get(
  '/series',
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    const categoryFilter = category ? 'AND s.category_id = $1' : '';
    const params = category ? [category] : [];
    const { rows } = await query(
      `SELECT s.id, s.title, s.slug, s.description, s.category_id, s.season_num,
              s.cover_url, s.order_index, s.parent_series_id, s.created_at,
              c.name  AS category_name,
              p.title AS parent_title,
              COUNT(DISTINCT ch.id)::int AS season_count,
              COUNT(DISTINCT v.id)::int  AS video_count
         FROM series s
         LEFT JOIN categories c ON c.id = s.category_id
         LEFT JOIN series p     ON p.id = s.parent_series_id
         LEFT JOIN series ch    ON ch.parent_series_id = s.id
         LEFT JOIN videos v     ON v.series_id = s.id
        WHERE 1 = 1 ${categoryFilter}
        GROUP BY s.id, c.name, p.title
        ORDER BY s.order_index, s.title`,
      params,
    );
    res.json({ series: rows });
  }),
);

adminRouter.post(
  '/series',
  asyncHandler(async (req, res) => {
    const parsed = seriesSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;
    await assertValidParentSeries(d.parentSeriesId, null);
    const safeDescription = d.description ? sanitizeHtml(d.description, RICH_TEXT_SANITIZE_OPTIONS) : null;

    const series = await queryOne(
      `INSERT INTO series (title, slug, description, category_id, season_num, cover_url, order_index, parent_series_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        d.title, d.slug, safeDescription, d.categoryId ?? null,
        d.seasonNum ?? 1, d.coverUrl ?? null, d.orderIndex ?? 0, d.parentSeriesId ?? null,
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

    if (parsed.data.parentSeriesId) {
      await assertValidParentSeries(parsed.data.parentSeriesId, req.params.id);
    }

    if (parsed.data.description !== undefined) {
      parsed.data.description = parsed.data.description
        ? sanitizeHtml(parsed.data.description, RICH_TEXT_SANITIZE_OPTIONS)
        : '';
    }

    const map = {
      title: 'title', slug: 'slug', description: 'description',
      categoryId: 'category_id', seasonNum: 'season_num',
      coverUrl: 'cover_url', orderIndex: 'order_index',
      parentSeriesId: 'parent_series_id',
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
      `DELETE FROM series WHERE id = $1 RETURNING id, cover_url`,
      [req.params.id],
    );
    if (!series) throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');
    // Borra el archivo del disco si la portada era una imagen local
    if (series.cover_url) {
      const filename = path.basename(series.cover_url);
      deleteFileIfExists(path.join(SERIES_UPLOADS_DIR, filename));
    }
    res.status(204).end();
  }),
);

// POST /admin/series/:id/cover — sube o reemplaza la portada (16:9)
adminRouter.post(
  '/series/:id/cover',
  seriesCoverUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No se recibió ninguna imagen', 'NO_FILE');

    const current = await queryOne('SELECT id, cover_url FROM series WHERE id = $1', [req.params.id]);
    if (!current) {
      deleteFileIfExists(req.file.path); // limpia el archivo recién subido
      throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');
    }

    // Borra el archivo anterior si era una imagen local
    if (current.cover_url) {
      const oldFilename = path.basename(current.cover_url);
      deleteFileIfExists(path.join(SERIES_UPLOADS_DIR, oldFilename));
    }

    const coverUrl = `${req.protocol}://${req.get('host')}/uploads/series/${req.file.filename}`;
    const series = await queryOne(
      'UPDATE series SET cover_url = $1 WHERE id = $2 RETURNING *',
      [coverUrl, req.params.id],
    );
    res.json({ series });
  }),
);

// DELETE /admin/series/:id/cover — elimina la portada
adminRouter.delete(
  '/series/:id/cover',
  asyncHandler(async (req, res) => {
    const current = await queryOne('SELECT id, cover_url FROM series WHERE id = $1', [req.params.id]);
    if (!current) throw notFound('Serie no encontrada', 'SERIES_NOT_FOUND');

    if (current.cover_url) {
      const filename = path.basename(current.cover_url);
      deleteFileIfExists(path.join(SERIES_UPLOADS_DIR, filename));
    }
    await queryOne('UPDATE series SET cover_url = NULL WHERE id = $1 RETURNING id', [req.params.id]);
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
    const safeBio = d.bio ? sanitizeHtml(d.bio, RICH_TEXT_SANITIZE_OPTIONS) : null;
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
        ? sanitizeHtml(parsed.data.bio, RICH_TEXT_SANITIZE_OPTIONS)
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

// =====================================================================
// CRUD de páginas de contenido (Sobre nosotros, legales, Contacto...).
// Conjunto acotado de páginas fijas precargado por la migración 010; crear
// y borrar quedan disponibles pero no son el caso de uso principal — lo
// habitual es editar el contenido/SEO de las seis páginas ya existentes.
// =====================================================================
const pageSchema = z.object({
  slug:            z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug solo puede contener a-z, 0-9 y guiones'),
  title:           z.string().min(1),
  content:         z.string().optional(),
  metaTitle:       z.string().optional(),
  metaDescription: z.string().optional(),
});

// GET /admin/pages — listado (sin el HTML completo, para la tabla del panel)
adminRouter.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, slug, title, meta_title, meta_description, og_image, updated_at
         FROM pages ORDER BY title`,
    );
    res.json({ pages: rows });
  }),
);

// GET /admin/pages/:slug — página completa (con content) para el formulario de edición
adminRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await queryOne(`SELECT * FROM pages WHERE slug = $1`, [req.params.slug]);
    if (!page) throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');
    res.json({ page });
  }),
);

adminRouter.post(
  '/pages',
  asyncHandler(async (req, res) => {
    const parsed = pageSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');
    const d = parsed.data;

    const existing = await queryOne('SELECT id FROM pages WHERE slug = $1', [d.slug]);
    if (existing) throw badRequest('Ya existe una página con ese slug', 'SLUG_TAKEN');

    const safeContent = d.content ? sanitizeHtml(d.content, RICH_TEXT_SANITIZE_OPTIONS) : null;
    const page = await queryOne(
      `INSERT INTO pages (slug, title, content, meta_title, meta_description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [d.slug, d.title, safeContent, d.metaTitle ?? null, d.metaDescription ?? null],
    );
    res.status(201).json({ page });
  }),
);

adminRouter.put(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const parsed = pageSchema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    if (parsed.data.content !== undefined) {
      parsed.data.content = parsed.data.content
        ? sanitizeHtml(parsed.data.content, RICH_TEXT_SANITIZE_OPTIONS)
        : '';
    }

    const map = {
      slug: 'slug', title: 'title', content: 'content',
      metaTitle: 'meta_title', metaDescription: 'meta_description',
    };
    const sets = []; const params = [];
    for (const [key, col] of Object.entries(map)) {
      if (parsed.data[key] !== undefined) {
        params.push(parsed.data[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) throw badRequest('Nada que actualizar', 'EMPTY_UPDATE');

    params.push(req.params.slug);
    const page = await queryOne(
      `UPDATE pages SET ${sets.join(', ')} WHERE slug = $${params.length} RETURNING *`,
      params,
    );
    if (!page) throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');
    res.json({ page });
  }),
);

adminRouter.delete(
  '/pages/:id',
  asyncHandler(async (req, res) => {
    const page = await queryOne(`DELETE FROM pages WHERE id = $1 RETURNING id, og_image`, [req.params.id]);
    if (!page) throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');
    if (page.og_image) {
      const filename = path.basename(page.og_image);
      deleteFileIfExists(path.join(PAGES_UPLOADS_DIR, filename));
    }
    res.status(204).end();
  }),
);

// POST /admin/pages/:slug/image — sube/reemplaza la imagen social (og_image)
adminRouter.post(
  '/pages/:slug/image',
  pageImageUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No se recibió ninguna imagen', 'NO_FILE');

    const current = await queryOne('SELECT id, og_image FROM pages WHERE slug = $1', [req.params.slug]);
    if (!current) {
      deleteFileIfExists(req.file.path);
      throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');
    }

    if (current.og_image) {
      const oldFilename = path.basename(current.og_image);
      deleteFileIfExists(path.join(PAGES_UPLOADS_DIR, oldFilename));
    }

    const ogImage = `${req.protocol}://${req.get('host')}/uploads/pages/${req.file.filename}`;
    const page = await queryOne(
      'UPDATE pages SET og_image = $1 WHERE slug = $2 RETURNING *',
      [ogImage, req.params.slug],
    );
    res.json({ page });
  }),
);

// DELETE /admin/pages/:slug/image — elimina la imagen social
adminRouter.delete(
  '/pages/:slug/image',
  asyncHandler(async (req, res) => {
    const current = await queryOne('SELECT id, og_image FROM pages WHERE slug = $1', [req.params.slug]);
    if (!current) throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');

    if (current.og_image) {
      const filename = path.basename(current.og_image);
      deleteFileIfExists(path.join(PAGES_UPLOADS_DIR, filename));
    }
    await queryOne('UPDATE pages SET og_image = NULL WHERE slug = $1 RETURNING id', [req.params.slug]);
    res.status(204).end();
  }),
);

// =====================================================================
// Bandeja de mensajes del formulario de contacto (guardados por POST /contact,
// endpoint público en routes/contact.js).
// =====================================================================

// GET /admin/contact-messages?read=true|false&limit&offset
adminRouter.get(
  '/contact-messages',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    const { read } = req.query;

    const filters = [];
    const params = [];
    if (read === 'true') filters.push('read_at IS NOT NULL');
    else if (read === 'false') filters.push('read_at IS NULL');
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countRow = await queryOne(`SELECT COUNT(*)::int AS total FROM contact_messages ${where}`, params);
    const unreadRow = await queryOne(`SELECT COUNT(*)::int AS n FROM contact_messages WHERE read_at IS NULL`);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT id, name, email, subject, message, read_at, created_at
         FROM contact_messages
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ messages: rows, limit, offset, total: countRow.total, unread: unreadRow.n });
  }),
);

// PUT /admin/contact-messages/:id  { read: boolean } — marca leído/no leído
adminRouter.put(
  '/contact-messages/:id',
  asyncHandler(async (req, res) => {
    const schema = z.object({ read: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message, 'VALIDATION');

    const message = await queryOne(
      `UPDATE contact_messages SET read_at = $1 WHERE id = $2 RETURNING *`,
      [parsed.data.read ? new Date() : null, req.params.id],
    );
    if (!message) throw notFound('Mensaje no encontrado', 'MESSAGE_NOT_FOUND');
    res.json({ message });
  }),
);

// DELETE /admin/contact-messages/:id
adminRouter.delete(
  '/contact-messages/:id',
  asyncHandler(async (req, res) => {
    const message = await queryOne(
      `DELETE FROM contact_messages WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!message) throw notFound('Mensaje no encontrado', 'MESSAGE_NOT_FOUND');
    res.status(204).end();
  }),
);
