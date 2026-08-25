// =====================================================================
// Rutas de usuario.  (Briefing 4.1, 5.1, 5.3)
//   POST   /watch-history            guarda/actualiza progreso
//   GET    /watch-history/continue   "Continuar viendo"
//   GET    /watchlist                favoritos
//   POST   /watchlist/:videoId       añadir a favoritos
//   DELETE /watchlist/:videoId       quitar de favoritos
//   POST   /push-tokens              registra token FCM
//   POST   /billing/checkout         sesión de Stripe Checkout (alta de plan)
//   POST   /billing/portal           sesión Customer Portal de Stripe
//   GET    /billing/payment-method   tarjeta de la suscripción actual (para /perfil)
// =====================================================================
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { createPortalSession, getOrCreateStripeCustomer, resolvePriceIdForPlan, createCheckoutSession, getSubscriptionCardSummary } from '../services/stripe.js';
import { config } from '../config/index.js';

export const userRouter = Router();

// --- Watch history: UPSERT de progreso -------------------------------
userRouter.post(
  '/watch-history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      videoId: z.string().uuid(),
      progressSec: z.number().int().min(0),
      completed: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', 'VALIDATION');
    const { videoId, progressSec, completed } = parsed.data;

    await query(
      `INSERT INTO watch_history (user_id, video_id, progress_sec, completed, last_watched_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, video_id) DO UPDATE SET
          progress_sec    = EXCLUDED.progress_sec,
          completed       = EXCLUDED.completed,
          last_watched_at = now()`,
      [req.user.id, videoId, progressSec, completed ?? false],
    );
    res.status(204).end();
  }),
);

// --- "Continuar viendo" ----------------------------------------------
userRouter.get(
  '/watch-history/continue',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT v.id, v.title, v.slug, v.thumbnail_url, v.cover_vertical_url, v.duration_sec,
              h.progress_sec, h.last_watched_at
         FROM watch_history h
         JOIN videos v ON v.id = h.video_id
            AND v.published = true
            AND (v.published_at IS NULL OR v.published_at <= now())
        WHERE h.user_id = $1 AND h.completed = false AND h.progress_sec > 0
        ORDER BY h.last_watched_at DESC
        LIMIT 20`,
      [req.user.id],
    );
    res.json({ items: rows });
  }),
);

// --- Watchlist --------------------------------------------------------
userRouter.get(
  '/watchlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT v.id, v.title, v.slug, v.thumbnail_url, v.cover_vertical_url, v.duration_sec, w.added_at
         FROM watchlist w
         JOIN videos v ON v.id = w.video_id
            AND v.published = true
            AND (v.published_at IS NULL OR v.published_at <= now())
        WHERE w.user_id = $1
        ORDER BY w.added_at DESC`,
      [req.user.id],
    );
    res.json({ items: rows });
  }),
);

userRouter.post(
  '/watchlist/:videoId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(
      `INSERT INTO watchlist (user_id, video_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, video_id) DO NOTHING`,
      [req.user.id, req.params.videoId],
    );
    res.status(201).json({ ok: true });
  }),
);

userRouter.delete(
  '/watchlist/:videoId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query('DELETE FROM watchlist WHERE user_id = $1 AND video_id = $2', [
      req.user.id,
      req.params.videoId,
    ]);
    res.status(204).end();
  }),
);

// --- Registro de token push FCM --------------------------------------
userRouter.post(
  '/push-tokens',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      token: z.string().min(10),
      platform: z.enum(['ios', 'android', 'web']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', 'VALIDATION');

    await query(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [req.user.id, parsed.data.token, parsed.data.platform],
    );
    res.status(201).json({ ok: true });
  }),
);

// --- Checkout de Stripe (alta de una suscripción nueva) ---------------
userRouter.post(
  '/billing/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ plan: z.enum(['monthly', 'annual']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Plan inválido', 'VALIDATION');
    const { plan } = parsed.data;

    // Evita una segunda suscripción de pago si ya tiene una vigente (mismo
    // criterio que requireSubscription: period_end NULL = sin caducidad, y el
    // filtro de "no caducada" va en el WHERE para no descartar una cortesía
    // indefinida solo porque además exista otra fila con fecha ya caducada).
    const existing = await queryOne(
      `SELECT status, period_end FROM subscriptions
        WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
          AND (period_end IS NULL OR period_end > now())
        LIMIT 1`,
      [req.user.id],
    );
    if (existing) throw badRequest('Ya tienes una suscripción activa', 'ALREADY_SUBSCRIBED');

    const customerId = await getOrCreateStripeCustomer(req.user);
    const priceId = await resolvePriceIdForPlan(plan);

    const session = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${config.publicUrl}/planes/activada?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.publicUrl}/planes`,
    });

    res.json({ url: session.url });
  }),
);

// --- Customer Portal de Stripe (gestión de suscripción) --------------
userRouter.post(
  '/billing/portal',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user.stripe_customer_id) {
      throw badRequest('El usuario no tiene cliente de Stripe asociado', 'NO_STRIPE_CUSTOMER');
    }
    const session = await createPortalSession(
      req.user.stripe_customer_id,
      `${config.publicUrl}/perfil`,
    );
    res.json({ url: session.url });
  }),
);

// --- Tarjeta de la suscripción actual (para /perfil) ------------------
// Mismo criterio que GET /auth/me para elegir "la" suscripción: prioriza
// la vigente ahora mismo. Si es de cortesía (sin stripe_sub_id) o el
// usuario no tiene stripe_customer_id, no hay tarjeta que mostrar.
userRouter.get(
  '/billing/payment-method',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = await queryOne(
      `SELECT stripe_sub_id FROM subscriptions
        WHERE user_id = $1
        ORDER BY
          (status IN ('active','trialing','past_due') AND (period_end IS NULL OR period_end > now())) DESC,
          period_end DESC NULLS FIRST
        LIMIT 1`,
      [req.user.id],
    );

    if (!sub?.stripe_sub_id && !req.user.stripe_customer_id) {
      return res.json({ paymentMethod: null });
    }

    // Es solo un detalle cosmético del perfil — si Stripe falla (rate limit,
    // hipo de red...) no debe tumbar la página con un 500, mejor no mostrar
    // la tarjeta esta vez.
    let paymentMethod = null;
    try {
      paymentMethod = await getSubscriptionCardSummary(sub?.stripe_sub_id ?? null, req.user.stripe_customer_id);
    } catch (err) {
      console.error('[billing] No se pudo obtener el método de pago:', err.message);
    }
    res.json({ paymentMethod });
  }),
);
