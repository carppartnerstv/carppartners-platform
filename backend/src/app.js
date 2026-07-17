// =====================================================================
// Construcción de la app Express. Separado de server.js para poder
// testear sin abrir el puerto.
// =====================================================================
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { config } from './config/index.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { userRouter } from './routes/user.js';
import { adminRouter } from './routes/admin.js';
import { pagesRouter } from './routes/pages.js';
import { contactRouter } from './routes/contact.js';
import { stripeWebhookRouter } from './routes/stripe.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // detrás de Nginx
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(morgan(config.isProd ? 'combined' : 'dev'));

  // Ficheros subidos — solo expone backend/uploads/, no otras rutas del sistema.
  // Helmet pone Cross-Origin-Resource-Policy: same-origin globalmente; lo
  // sobreescribimos a "cross-origin" solo para /uploads para que los <img>
  // cargados desde la web (puerto 3000) no sean bloqueados por el navegador.
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(__dirname, '../uploads'), {
    index: false,
    dotfiles: 'deny',
  }));

  // --- Webhook de Stripe: ANTES de express.json (necesita raw body) ---
  app.use('/stripe', stripeWebhookRouter);

  // A partir de aquí, JSON normal.
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck (lo usa el deploy y Nginx para comprobar que está vivo)
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

  // Los límites de fuerza bruta/spam (login, registro, recuperar contraseña,
  // formulario de contacto) se aplican a nivel de ruta concreta dentro de
  // cada router (auth.js, contact.js) — nunca aquí montados en '/', porque
  // eso aplicaría el límite a TODA la API, no solo a esa ruta.
  app.use('/auth', authRouter);
  app.use('/', contactRouter); // /contact — pública, sin login
  app.use('/', pagesRouter); // /pages/:slug — pública, sin login
  app.use('/', catalogRouter); // /videos, /categories, /series
  app.use('/', userRouter); // /watch-history, /watchlist, /push-tokens, /billing
  app.use('/admin', adminLimiter, adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
