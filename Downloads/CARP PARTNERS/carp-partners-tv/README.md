# Carp Partners TV

Plataforma de vídeo tipo Netflix especializada en carpfishing. Reemplaza el stack actual de WordPress + ARMember por una solución propia, moderna y de bajo coste, que funciona en **web, iOS y Android** desde un único repositorio.

> Estado: **Backbone del backend completo y probado** (Semanas 1–3 de la hoja de ruta). Frontend web/móvil y panel admin UI: siguientes fases.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend web | Next.js 14 (App Router) + Tailwind |
| App móvil | React Native + Expo SDK 51 |
| Backend / API | Node.js 20 + Express 5 |
| Base de datos | PostgreSQL 16 (node-postgres, sin ORM de pago) |
| Caché / sesiones | Redis 7 |
| Vídeo | Vimeo Pro/Business (proxy seguro, Domain Privacy) |
| Pagos | Stripe directo + webhooks nativos |
| Servidor | Nginx + pm2 sobre VPS Hetzner (Ubuntu 24 LTS) |
| Deploy | GitHub Actions → SSH → VPS |

## Estructura del monorepo

```
carp-partners-tv/
├── backend/              API REST Node/Express  ← LISTO Y PROBADO
│   ├── src/
│   │   ├── config/       config validada, pool PostgreSQL, cliente Redis
│   │   ├── middleware/   auth JWT, requireSubscription, requireAdmin, errores
│   │   ├── routes/       auth, catalog, user, admin, stripe (webhook)
│   │   ├── services/     vimeo (proxy seguro), stripe, subscriptions
│   │   ├── utils/        tokens JWT, errores HTTP tipados
│   │   ├── app.js        ensamblado Express
│   │   └── server.js     arranque + apagado limpio
│   ├── db/
│   │   ├── migrations/   001_init_schema.sql, 002_user_interaction.sql
│   │   ├── migrate.js    runner de migraciones versionadas
│   │   └── seed.dev.sql  datos de ejemplo (solo dev)
│   └── .env.example
├── scripts/
│   └── migrate-stripe.js Migración de suscriptores desde Stripe (Briefing §6)
├── apps/{web,mobile,admin}/   ← siguientes fases (semanas 4–8)
├── packages/{ui,api-client}/  ← componentes compartidos
├── deploy/
│   ├── nginx/carppartners.tv.conf
│   └── setup-vps.sh      provisión completa del VPS (idempotente)
├── ecosystem.config.cjs  configuración pm2
└── .github/workflows/deploy.yml
```

## Arranque local

```bash
# 1) Backend
cd backend
cp .env.example .env          # rellenar secretos (DB, JWT, Stripe, Vimeo)
npm install
npm run migrate               # crea el esquema
psql "$DATABASE_URL" -f db/seed.dev.sql   # opcional: datos de ejemplo
npm run dev                   # API en http://localhost:3001
```

Requiere PostgreSQL 16 y Redis 7 en local (o el VPS provisionado).

## API — endpoints implementados

Todos bajo `/api/*` en producción (Nginx reescribe). Auth = `Authorization: Bearer <accessToken>`.

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` | pública |
| GET | `/auth/me` | JWT |
| POST | `/auth/set-password` | token migración |
| GET | `/videos` · `/videos/:id` | JWT + suscripción |
| GET | `/videos/:id/stream` (proxy Vimeo firmado) | JWT + suscripción |
| GET | `/categories` · `/series` | JWT |
| POST | `/watch-history` · GET `/watch-history/continue` | JWT |
| GET/POST/DELETE | `/watchlist` · `/watchlist/:videoId` | JWT |
| POST | `/push-tokens` · `/billing/portal` | JWT |
| POST | `/stripe/webhook` | firma Stripe |
| GET | `/admin/dashboard` · `/admin/users` · `/admin/payments` | JWT + admin |
| POST/PUT/DELETE | `/admin/videos` · `/admin/videos/:id` | JWT + admin |

## Seguridad — claves del diseño

- **Proxy de Vimeo** (`services/vimeo.js`): las credenciales de Vimeo viven solo en el servidor; el cliente recibe únicamente un enlace HLS que caduca. Sin suscripción → 403 → la app muestra planes.
- **JWT con refresh rotativo**: access 24h + refresh 30d guardado en Redis (revocable en logout).
- **Suscripción verificada en cada petición** contra PostgreSQL (fuente de verdad sincronizada por webhooks de Stripe).
- **Webhook de Stripe con verificación de firma** sobre el body crudo, antes de `express.json()`.

## Despliegue (resumen)

1. Crear VPS Hetzner CX22 → `bash deploy/setup-vps.sh` (instala Node, PostgreSQL, Redis, Nginx, pm2, Certbot, UFW).
2. `git clone` en `/var/www/carp-partners-tv`, rellenar `backend/.env`.
3. `npm ci && npm run migrate` · `pm2 start ecosystem.config.cjs`.
4. `certbot --nginx -d carppartners.tv`.
5. Configurar el endpoint de webhook en Stripe → `https://carppartners.tv/api/stripe/webhook`.
6. Push a `main` → GitHub Actions despliega automáticamente (pull, build, migrate, reload).

## Progreso vs hoja de ruta

- **Semana 1** ✅ Monorepo, provisión VPS, Nginx, pm2, GitHub Actions.
- **Semana 2** ✅ Auth JWT, esquema BD completo, webhook Stripe, script migración.
- **Semana 3** ✅ Catálogo API, proxy Vimeo, watch-history, watchlist (+ tests de arranque y migraciones).
- **Semana 4–6** ⏭ Frontend web (Next.js), app móvil (Expo), panel admin UI.
- **Semana 7–10** ⏭ Explorar/Mi Lista/Perfil, emails (Resend), QA, publicación en tiendas.
