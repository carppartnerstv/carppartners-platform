# CLAUDE.md — Contexto del proyecto Carp Partners TV

> Este archivo lo lee Claude Code automáticamente. Es la fuente de contexto
> permanente del proyecto. La **fuente de verdad funcional** es el documento
> *Briefing Técnico v2.0 (Junio 2026)*; si algo aquí entra en conflicto con el
> briefing, manda el briefing y debes avisarlo.

## Qué es

Plataforma de vídeo tipo Netflix especializada en carpfishing. Reemplaza el
stack WordPress + ARMember + Stripe por una solución propia, moderna y de bajo
coste. Funciona en **web (navegador), iOS y Android** desde un único monorepo.
Dominio de producción: `carppartners.tv`.

## Principios no negociables (del briefing)

- **Software 100% libre / bajo coste.** Nada de Vercel, Railway ni plataformas
  de pago. Todo se autoaloja en un VPS Hetzner detrás de Nginx.
- **Next.js en modo `standalone`** servido por Nginx (no `next export`, no SSR
  en plataformas externas). La app móvil se compila con Expo EAS o en local.
- **Componentes compartidos** entre web y móvil en `/packages/ui`. El mismo
  PlayerCard, botón de suscripción y reproductor se usan en ambos.
- **El cliente nunca ve credenciales** de Vimeo ni de Stripe. Todo pasa por el
  backend.
- **Branding Carp Partners**: respeta logo, colores y estética existentes
  (estética oscura tipo Netflix). Pregunta por los tokens de color si no están
  definidos aún; no inventes una identidad nueva.

## Stack y versiones

- Monorepo con workspaces npm.
- Web: **Next.js 14 (App Router) + Tailwind CSS**.
- Móvil: **React Native + Expo SDK 51 + Expo Router**.
- Backend: **Node.js 20 + Express 5** (ESM, `"type": "module"`).
- BD: **PostgreSQL 16** vía `pg` (sin ORM). Caché/sesiones: **Redis 7**.
- Pagos: **Stripe** directo. Vídeo: **Vimeo** (HLS, Domain Privacy).

## Estructura del monorepo

```
carp-partners-tv/
├── backend/              API REST  ← YA EXISTE Y FUNCIONA, no reescribir
│   ├── src/{config,middleware,routes,services,utils,app.js,server.js}
│   └── db/{migrations,migrate.js,seed.dev.sql}
├── scripts/              migración Stripe, resolver price_ids, config. Customer Portal
├── apps/web/             Next.js   ← TRABAJO ACTUAL
├── apps/mobile/          Expo      ← siguiente
├── apps/admin/           panel admin (puede vivir como ruta /admin de web)
├── packages/ui/          componentes compartidos web+móvil
├── packages/api-client/  cliente HTTP tipado del backend  ← crear y reutilizar
├── deploy/{nginx,setup-vps.sh}
├── ecosystem.config.cjs  (pm2)
└── .github/workflows/deploy.yml
```

## Estado actual (NO rehacer salvo que se pida)

El **backend está completo y probado** para las Semanas 1–3 del briefing:
auth JWT, esquema de BD (11 tablas), webhooks Stripe, proxy seguro de Vimeo,
catálogo, watch-history, watchlist, endpoints admin, migración de Stripe,
config de Nginx/pm2/GitHub Actions. Corre en `http://localhost:3001`.

## Contrato del API (consúmelo, no lo cambies sin avisar)

Auth por cabecera `Authorization: Bearer <accessToken>`. En producción todo
cuelga de `/api/*` (Nginx reescribe quitando `/api`). En local es directo a
`:3001`. Errores siempre como `{ "error": { "message": string, "code": string } }`.

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| POST | `/auth/register` | pública | `{user, accessToken, refreshToken}` |
| POST | `/auth/login` | pública | `{user, accessToken, refreshToken}` |
| POST | `/auth/refresh` | pública (refreshToken en body) | `{user, accessToken, refreshToken}` |
| POST | `/auth/logout` | pública | 204 |
| GET | `/auth/me` | JWT | `{user, subscription}` |
| POST | `/auth/forgot-password` `{email}` | pública | `{ok}` — siempre responde igual, exista o no la cuenta (no revela emails registrados); genera un `password_set_token` de 30 min y envía `passwordResetEmail` sin esperar a que el email salga |
| POST | `/auth/set-password` | token | `{ok}` — mismo endpoint para migración WP, alta manual desde el panel y recuperar contraseña (todos usan `password_set_token`/`password_set_expires`) |
| POST | `/auth/change-password` `{currentPassword,newPassword}` | JWT | `{ok}` — cambio de contraseña desde Perfil estando ya logueado (añadido 2026-07, ver Perfil) |
| PUT | `/auth/me` `{name}` | JWT | `{user}` — "Editar perfil"; el email NO es editable aquí (ligado a Stripe) |
| POST | `/auth/me/avatar` `multipart/form-data; field=avatar` | JWT | `{user}` — sube/reemplaza la foto propia (JPG/PNG/WebP, máx 5 MB) |
| DELETE | `/auth/me/avatar` | JWT | 204 |
| GET | `/pages/:slug` | pública | `{page}` — contenido + SEO (`meta_title`,`meta_description`,`og_image`) de una página fija (Sobre nosotros, legales, Contacto...); usada por las rutas públicas homónimas de `apps/web` |
| POST | `/contact` `{name,email,subject?,message}` | pública (rate-limited) | `{ok}` 201 — guarda en `contact_messages`, avisa a `MAIL_ADMIN` y manda acuse de recibo al remitente (ninguno de los dos correos se espera antes de responder) |
| GET | `/videos?limit&offset&category&series&q` | JWT + suscripción | `{videos, limit, offset}` |
| GET | `/videos/featured` | JWT + suscripción | `{video}` — destacado de portada de Home: el marcado manualmente (`is_featured`) o, si no hay ninguno, fallback al criterio automático (primera categoría por `order_index` · primer vídeo). Registrada antes de `/videos/:id` en el router |
| GET | `/videos/:id` | JWT + suscripción | `{video, related}` — cada `related` incluye `progress_sec`/`completed` del usuario actual, para pintar su línea de tiempo en "Más como esto" |
| GET | `/videos/:id/stream` | JWT + suscripción | `{hlsUrl, expiresInSec}` |
| POST | `/videos/:id/rating` `{rating: -1\|1\|2}` | JWT + suscripción | `{rating}` — UPSERT del voto (-1 no es para mí, 1 me gusta, 2 me encanta) |
| GET | `/videos/:id/rating` | JWT + suscripción | `{rating: -1\|1\|2\|null}` — valoración del usuario actual para ese vídeo |
| DELETE | `/videos/:id/rating` | JWT + suscripción | 204 — quita la valoración del usuario |
| GET | `/categories` | JWT | `{categories}` |
| GET | `/series?category` | JWT | `{series}` — solo series de primer nivel (`parent_series_id IS NULL`); `episode_count` suma los episodios propios + los de todas sus temporadas |
| GET | `/series/:id` | JWT | `{series, seasons}` — `seasons` son las temporadas (filas de `series` con `parent_series_id` = esta serie) con su propio `episode_count`. Si `seasons` viene vacío, la serie es "plana": sus episodios se piden con `GET /videos?series=<id>`. Si no, cada temporada expone su propio id para pedir `GET /videos?series=<seasonId>` |
| POST | `/watch-history` `{videoId,progressSec,completed?}` | JWT | 204 |
| GET | `/watch-history/continue` | JWT | `{items}` |
| GET | `/watchlist` | JWT | `{items}` |
| POST | `/watchlist/:videoId` | JWT | 201 |
| DELETE | `/watchlist/:videoId` | JWT | 204 |
| POST | `/push-tokens` `{token,platform}` | JWT | 201 |
| POST | `/billing/checkout` `{plan: 'monthly'\|'annual'}` | JWT | `{url}` 200 — crea la Stripe Checkout Session (modo `subscription`) para dar de alta un plan nuevo; crea el Customer de Stripe si el usuario no tenía uno y lo persiste en `users.stripe_customer_id` ANTES de crear la sesión (lo necesita el webhook para resolver el usuario). `400 ALREADY_SUBSCRIBED` si ya tiene una suscripción vigente (usa `/billing/portal` para gestionarla, no un checkout nuevo) |
| POST | `/billing/portal` | JWT | `{url}` |
| GET | `/admin/dashboard` | JWT + admin | `{activeSubscribers,publishedVideos,playsToday,mrr}` |
| GET | `/admin/users?status&q&limit&offset` | JWT + admin | `{users}` — cada usuario incluye `source: 'stripe'\|'courtesy'\|null` de su suscripción más reciente |
| POST | `/admin/users` `{email,name?,password?}` | JWT + admin | `{user, setPasswordToken}` 201 — alta manual de suscriptor, sin pasar por `/auth/register`. Si se omite `password`, el usuario queda sin `password_hash` y se devuelve `setPasswordToken` (mismo mecanismo que la migración desde WordPress, TTL 14 días) para construir el enlace `/set-password?token=...`; con `password`, `setPasswordToken` es `null` |
| POST | `/admin/users/:id/courtesy-subscription` `{durationMonths?, endDate?, indefinite?}` | JWT + admin | `{subscription}` 200/201 — otorga o extiende (upsert sobre la misma fila) una suscripción de cortesía (`source='courtesy'`, sin `stripe_sub_id`). Exactamente una de las tres opciones; `indefinite` deja `period_end = NULL` (no caduca nunca) |
| GET | `/admin/payments` | JWT + admin | `{payments}` |
| POST/PUT/DELETE | `/admin/videos[/:id]` | JWT + admin | vídeo / 204 |
| GET | `/admin/videos?published&category&series&q&sort&limit&offset` | JWT + admin | `{videos,limit,offset}` — incluye borradores. `sort=rated` ordena por nº de votos desc. Cada vídeo incluye `ratings: {love,like,down,total,avg}` e `is_featured` |
| POST/PUT | `/admin/videos[/:id]` con `{isFeatured: boolean}` | JWT + admin | `{video}` — marca/desmarca el destacado de portada (mismo endpoint que el resto de campos). Solo puede haber uno activo: al marcar `true`, el backend desmarca automáticamente cualquier otro dentro de la misma transacción (reforzado además por un índice único parcial en BD) |
| POST | `/admin/categories` `{name,slug,description?,coverUrl?,orderIndex?}` | JWT + admin | `{category}` 201 |
| PUT | `/admin/categories/:id` | JWT + admin | `{category}` |
| DELETE | `/admin/categories/:id` | JWT + admin | 204 |
| GET | `/admin/series?category` | JWT + admin | `{series}` — TODAS las series (incluidas las temporadas), con `parent_series_id`, `parent_title`, `season_count`, `video_count` |
| POST | `/admin/series` `{title,slug,description?,categoryId?,seasonNum?,coverUrl?,orderIndex?,parentSeriesId?}` | JWT + admin | `{series}` 201 — `parentSeriesId` convierte la serie en una temporada de otra (solo 1 nivel de profundidad: el padre no puede tener a su vez padre, y una serie con temporadas propias no puede recibir padre) |
| PUT | `/admin/series/:id` | JWT + admin | `{series}` — mismas reglas de `parentSeriesId`; enviar `null` explícito quita la serie madre |
| DELETE | `/admin/series/:id` | JWT + admin | 204 — si tenía temporadas, quedan huérfanas (pasan a ser series de primer nivel, `parent_series_id = NULL`); borra también el archivo de portada del disco si era local |
| POST | `/admin/series/:id/cover` `multipart/form-data; field=cover` | JWT + admin | `{series}` — sube/reemplaza la portada (JPG/PNG/WebP, máx 5 MB; pensada para 16:9 1920×1080); la URL pública se guarda en `series.cover_url` |
| DELETE | `/admin/series/:id/cover` | JWT + admin | 204 — borra el archivo de disco y pone `cover_url = NULL` |
| GET | `/admin/vimeo/:vimeoId/metadata` | JWT + admin | `{title,durationSec,thumbnailUrl}` — autorelleno formulario |
| GET | `/admin/pages` | JWT + admin | `{pages}` — listado sin `content` (para la tabla del panel) |
| GET | `/admin/pages/:slug` | JWT + admin | `{page}` — página completa, con `content`, para el formulario de edición |
| POST | `/admin/pages` `{slug,title,content?,metaTitle?,metaDescription?}` | JWT + admin | `{page}` 201 — crear página nueva; no es el caso de uso principal (las seis páginas fijas ya existen desde la migración 010), pero queda disponible |
| PUT | `/admin/pages/:slug` | JWT + admin | `{page}` — `content` se sanitiza igual que la bio de crew (`RICH_TEXT_SANITIZE_OPTIONS`) |
| DELETE | `/admin/pages/:id` | JWT + admin | 204 — borra también la imagen social del disco si era local |
| POST | `/admin/pages/:slug/image` `multipart/form-data; field=image` | JWT + admin | `{page}` — sube/reemplaza la imagen social (`og_image`, JPG/PNG/WebP, máx 5 MB) |
| DELETE | `/admin/pages/:slug/image` | JWT + admin | 204 — borra el archivo de disco y pone `og_image = NULL` |
| GET | `/admin/contact-messages?read&limit&offset` | JWT + admin | `{messages, total, unread}` — bandeja de `POST /contact`; `read=true\|false` filtra por leído/no leído |
| PUT | `/admin/contact-messages/:id` `{read: boolean}` | JWT + admin | `{message}` — marca leído/no leído (`read_at`) |
| DELETE | `/admin/contact-messages/:id` | JWT + admin | 204 |
| GET | `/admin/crew` | JWT + admin | `{crew}` |
| POST | `/admin/crew` `{name,slug,role?,bio?,avatarUrl?,orderIndex?}` | JWT + admin | `{member}` 201 |
| PUT | `/admin/crew/:id` | JWT + admin | `{member}` |
| DELETE | `/admin/crew/:id` | JWT + admin | 204 — borra también el archivo de disco si era local |
| POST | `/admin/crew/:id/avatar` `multipart/form-data; field=avatar` | JWT + admin | `{member}` — sube/reemplaza imagen (JPG/PNG/WebP, máx 5 MB); la URL pública se guarda en `crew_members.avatar_url` |
| DELETE | `/admin/crew/:id/avatar` | JWT + admin | 204 — borra el archivo de disco y pone `avatar_url = NULL` |
| GET | `/crew` | JWT | `{crew}` — lista para filtros en web/móvil |
| GET | `/videos?crew=<slug>` | JWT + suscripción | filtra por miembro de la crew |

**Regla de visibilidad pública (desde migración 004):**
Un vídeo es accesible para suscriptores si y solo si:
`published = true AND (published_at IS NULL OR published_at <= now())`
Los vídeos con `published_at` en el futuro están **programados** y no se sirven al cliente aunque `published = true`.
Los endpoints de admin devuelven todos los vídeos y añaden el campo `status: 'borrador' | 'programado' | 'publicado'`.
El campo `publishedAt` (camelCase en la API, `published_at` en BD) es opcional en POST/PUT:
- Si se omite y `published = true` → se asigna `now()` (visible de inmediato).
- Si se proporciona una fecha futura → el vídeo queda programado.
- Si se proporciona `null` o cadena vacía → se borra la fecha programada.

**Regla de acceso clave:** un 403 con `code: "SUBSCRIPTION_REQUIRED"` significa
que el usuario no tiene suscripción activa → la UI debe redirigir a la pantalla
de planes, no mostrar un error genérico. `requireSubscription` exige además que
`period_end` sea `NULL` (sin caducidad) o una fecha futura para los estados
`active`/`trialing`/`past_due` — no basta con el `status`, aplica también a
suscripciones de pago (protege contra un webhook de Stripe retrasado).

**Alta de suscripción (Stripe Checkout):** `POST /billing/checkout` (`backend/src/routes/user.js`)
crea/reutiliza el Customer (`services/stripe.js: getOrCreateStripeCustomer`, persiste
`users.stripe_customer_id` ANTES de crear la sesión — imprescindible para que el
webhook pueda resolver el usuario), resuelve el `price_id` activo del plan
(`resolvePriceIdForPlan`: usa `STRIPE_PRICE_MONTHLY/ANNUAL` si están configurados,
si no busca el precio activo del `STRIPE_PRODUCT_MONTHLY/ANNUAL` correspondiente vía
la API de Stripe) y crea la Checkout Session en modo `subscription` con
`success_url=${PUBLIC_URL}/planes/activada` y `cancel_url=${PUBLIC_URL}/planes`.
**El acceso lo activa el webhook, nunca el redirect de éxito** (el usuario podría
cerrar la pestaña antes de volver): `routes/stripe.js` procesa
`checkout.session.completed` (vía rápida) y `customer.subscription.created/updated`
(respaldo) llamando a `upsertSubscriptionFromStripe`, que hace
`INSERT ... ON CONFLICT (stripe_sub_id) DO UPDATE` — reprocesar el mismo evento
(reintentos de Stripe, o los dos eventos anteriores llegando por el mismo pago) nunca
duplica la fila. `invoice.payment_failed` → `past_due`; `customer.subscription.deleted`
→ `cancelled`. El endpoint rechaza con `400 ALREADY_SUBSCRIBED` si ya hay una
suscripción vigente (evita un segundo cobro accidental).

**Probar el Checkout en local:** con `STRIPE_SECRET_KEY`/`STRIPE_PRODUCT_MONTHLY`/
`STRIPE_PRODUCT_ANNUAL` de modo TEST en `backend/.env`, hace falta además reenviar los
webhooks a tu máquina (Stripe no puede llamar a `localhost` directamente):
```
stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' backend/.env | cut -d= -f2-)" \
  --forward-to localhost:3001/stripe/webhook
```
(nota: en local es `/stripe/webhook` sin el prefijo `/api/` — ese prefijo solo existe
en producción, donde Nginx lo reescribe antes de reenviar al backend). El comando
imprime un `whsec_...` propio de esa sesión de `stripe listen`, distinto del de
producción — hay que ponerlo en `STRIPE_WEBHOOK_SECRET` en el `.env` LOCAL (nunca en
`.env.example` ni tocar el de producción) y reiniciar el backend para que lo recargue
(`node --watch` no vigila cambios de `.env`). Con eso corriendo, el flujo real
funciona de principio a fin en el navegador con la tarjeta de pruebas
`4242 4242 4242 4242`.

**Cancelación y cambio de plan (Customer Portal):** `POST /billing/portal`
(`backend/src/routes/user.js`) abre el Customer Portal de Stripe — ahí es donde el
usuario cancela (al final del periodo, no al momento) o cambia entre mensual/anual;
no hay endpoints propios para ninguna de las dos cosas, todo vive en el portal
hospedado. El cambio de plan **hay que activarlo explícitamente en la
configuración de la cuenta de Stripe** (no viene activado por defecto): ejecuta
`node scripts/configure-stripe-portal.js` una vez por modo (test/live) — activa
`features.subscription_update` con los dos productos/precios y
`proration_behavior: 'create_prorations'` (cobra/abona la diferencia al momento del
cambio); es idempotente, lo puedes volver a ejecutar sin duplicar nada.
Cancelar desde el portal **no cambia `status` de inmediato** — Stripe la deja
`'active'` hasta que termina el periodo ya pagado y solo marca
`cancel_at_period_end=true` en la suscripción; por eso existe la columna
`subscriptions.cancel_at_period_end` (migración 012), que rellena
`upsertSubscriptionFromStripe` en cada `customer.subscription.updated`. La UI de
`/perfil` (`apps/web/src/app/(subscriber)/perfil/page.tsx`) usa ese campo para
mostrar "Cancelación programada · Acceso hasta el [fecha]" en vez de "Se renueva
el [fecha]" en cuanto el usuario cancela, sin esperar a que la baja sea
definitiva. El control de acceso (`requireSubscription`) no depende de este
campo — sigue basándose solo en `status`/`period_end`, que es lo que de verdad
determina si hay acceso.

**Suscripciones de cortesía (migración 009):** `subscriptions.source` distingue
`'stripe'` (con `stripe_sub_id`) de `'courtesy'` (regalo/familiar, sin
`stripe_sub_id`, `plan='courtesy'`). Se crean/extienden desde
`POST /admin/users/:id/courtesy-subscription`: `indefinite=true` → nunca
caduca; `durationMonths` o `endDate` → caduca igual que cualquier suscripción,
vía la comprobación de `period_end` de `requireSubscription`. Nunca las toques
por otra vía: los webhooks de Stripe (`services/subscriptions.js`) solo operan
sobre filas con `stripe_sub_id`, así que una fila de cortesía nunca se ve
afectada por ellos.

**Series con temporadas (migración 008):** `series.parent_series_id` (nullable,
FK a `series.id`) modela temporadas con un único nivel de profundidad. La
mayoría de series son "planas" (sin padre ni hijas). Una serie con varias
temporadas es una fila madre (`parent_series_id IS NULL`) con N filas hijas
que apuntan a ella; cada hija reutiliza `season_num` como número de temporada.
Reglas de negocio (impuestas en `admin.js`, no solo en la UI): una serie que
ya tiene temporadas propias no puede a su vez recibir un padre, y el padre
asignado nunca puede ser a su vez una temporada. `GET /series` (público) solo
devuelve series de primer nivel; usa `GET /series/:id` para sus temporadas.
Pendiente (decisión del usuario, no automatizar): reconvertir "La Picada 1" y
"La Picada 2" en temporadas de una nueva serie madre "La Picada" — se hace
manualmente desde `/admin/series` cuando el usuario lo decida, no por script.

## Rutas de la web (briefing 5.1)

| Ruta | Pantalla | Acceso |
|------|----------|--------|
| `/` | Landing (propuesta de valor, planes, login) | pública |
| `/login` | Login + registro. Tras registrarse redirige a `/planes?bienvenido=1`; tras login sin suscripción, a `/planes` | pública |
| `/planes` | Elegir plan (mensual/anual) y pagar. Si ya está logueado y sin suscripción, el botón de plan llama a `POST /billing/checkout` y redirige a Stripe Checkout (hospedado); si no hay sesión, redirige a `/login?mode=register`. Si ya tiene suscripción activa, redirige a `/home` | pública (contenido) / requiere sesión para pagar |
| `/planes/activada` | `success_url` del Checkout. El acceso lo activa el WEBHOOK, no este redirect (el usuario podría no volver aquí) — así que hace polling corto a `GET /auth/me` (cada 1,5s, máx. ~12s) hasta ver la suscripción activa y entonces redirige a `/home`; si tarda más, muestra un aviso con botón "Comprobar de nuevo" en vez de dejar al usuario colgado | suscriptores (recién pagado) |
| `/set-password?token=...` | Establece contraseña con un token de un solo uso (`POST /auth/set-password`) — usada por la migración desde WordPress, el alta manual desde el panel (`POST /admin/users` sin `password`) y "olvidé mi contraseña" (`POST /auth/forgot-password`, botón "¿Olvidaste tu contraseña?" en `/login`, con "Reenviar enlace" funcional) | pública |
| `/home` | Home tipo Netflix: hero + filas por categoría, una tarjeta por serie/película (no vídeos sueltos) | suscriptores |
| `/explorar` | Pestañas por categoría real + "Crew". En categorías: sin búsqueda, tarjetas de serie/película (filtradas por categoría); con texto, se filtran esas mismas tarjetas por título (siempre a nivel de serie/película, nunca vídeos sueltos). En "Crew": parrilla de miembros (`GET /crew`) filtrable por nombre; clic → `/crew/[slug]` | suscriptores |
| `/serie/[id]` | Detalle de una serie o película (portada, sinopsis, metadatos) + lista de episodios. Si la serie tiene temporadas (`GET /series/:id` → `seasons.length > 0`), muestra selector de temporada (por defecto la primera) y lista los episodios de la temporada elegida vía `GET /videos?series=<seasonId>`; si no, lista sus vídeos directamente vía `GET /videos?series=<id>`. Ruta única para series y películas (mismo modelo de datos). Clic en un episodio → `/watch/[id]` | suscriptores |
| `/watch/[id]` | Detalle del vídeo (sinopsis, Reparto, Mi Lista, relacionados) — clic en cualquier tarjeta lleva aquí | suscriptores |
| `/watch/[id]/play` | Reproductor a pantalla completa — solo se llega pulsando "Reproducir"/"Reanudar" desde el detalle | suscriptores |
| `/crew/[slug]` | Perfil de miembro de la crew (bio, "Vídeos con {nombre}") — se abre desde el Reparto del detalle | suscriptores |
| `/mi-lista` | Vídeos guardados | suscriptores |
| `/perfil` | Datos, plan activo, enlace a Customer Portal de Stripe | suscriptores |
| `/sobre-carp-partners`, `/aviso-legal`, `/politica-de-privacidad`, `/politica-de-cookies`, `/terminos-de-uso` | Páginas de contenido fijo editables desde `/admin/paginas` (`GET /pages/:slug`), maquetadas con `StaticPageLayout`/`StaticPageContent` (`apps/web/src/components/StaticPageLayout.tsx`). `generateMetadata()` en cada `page.tsx` aplica `meta_title`/`meta_description`/`og_image` de la página | pública |
| `/contacto` | Igual que las anteriores + `<ContactForm />` maquetado por código (no editable desde el panel), conectado a `POST /contact` | pública |
| `/admin` | Panel de administración | solo admin |

## Reproductor (briefing 5.3) — componente crítico

- **Web:** `<video>` + **HLS.js** para compatibilidad total (Chrome, Firefox;
  Safari soporta HLS nativo).
- Controles: play/pausa, progreso, volumen, pantalla completa, velocidad.
- Calidad adaptativa la gestiona el HLS de Vimeo (240p–1080p).
- **Guarda progreso**: al salir o periódicamente, `POST /watch-history` con
  `{videoId, progressSec}`. Reanuda desde `progress_sec` al volver a abrir.
- La URL HLS llega de `GET /videos/:id/stream` y **caduca (~1h)**: pídela justo
  antes de reproducir, no la caches a largo plazo.
- Chromecast/AirPlay quedan para Fase 2.

## Convenciones de código

- ESM en todo el repo (`import`/`export`).
- API en **camelCase**; la BD en **snake_case** (el backend ya traduce).
- Todas las llamadas al backend pasan por **`/packages/api-client`** (un único
  sitio que gestiona base URL, cabecera Bearer, refresh automático del token
  al recibir 401, y parseo del formato de error). No hagas `fetch` sueltos por
  las pantallas.
- Tokens: guarda `accessToken` en memoria y `refreshToken` de forma segura
  (web: cookie httpOnly si se añade endpoint, o storage; móvil: SecureStore).
- Tailwind con tokens de color centralizados; nada de estilos mágicos repetidos.
- Componentes de UI reutilizables en `/packages/ui`; las apps solo componen.

## Subida de archivos (avatars de crew, portadas de series, imagen social de páginas y de usuarios)

- Las imágenes se guardan en **`backend/uploads/crew/`** (avatar de crew),
  **`backend/uploads/series/`** (portada de serie/película, pensada para
  16:9 1920×1080), **`backend/uploads/pages/`** (imagen social/`og_image` de
  una página de contenido) o **`backend/uploads/avatars/`** (foto de perfil
  del propio usuario, subida desde Perfil → Editar perfil) con nombre único
  (`<timestamp>-<random>.<ext>`). Los cuatro comparten la misma factory
  `makeImageUpload(uploadsDir, fieldName)` en `admin.js` (mismo `multer`,
  misma validación) — para añadir un tipo de imagen más, reutiliza esa
  factory en vez de duplicar la configuración de `multer`.
- La carpeta **`backend/uploads/`** está en `.gitignore** y **debe incluirse en
  las copias de seguridad del servidor** (no está en el repositorio).
- El backend las sirve de forma estática en la ruta `/uploads/*` mediante
  `express.static` (solo esa carpeta, `index: false, dotfiles: 'deny'`).
- La URL pública almacenada en `crew_members.avatar_url` / `series.cover_url` /
  `pages.og_image` / `users.avatar_url` usa el host del request
  (`req.protocol + '://' + req.get('host')`):
  - Dev: `http://localhost:3001/uploads/crew/<filename>`, `/uploads/series/<filename>`, `/uploads/pages/<filename>` o `/uploads/avatars/<filename>`
  - Producción: requiere que Nginx tenga un `location /uploads/ { proxy_pass http://localhost:3001; }`.
- Al reemplazar o eliminar una imagen, el endpoint borra el archivo anterior del
  disco. Al eliminar la fila dueña (DELETE `/admin/crew/:id`, `/admin/series/:id`
  o `/admin/pages/:id`), también se borra su imagen del disco.
- `multer` gestiona la subida; validación: solo `image/jpeg`, `image/png`,
  `image/webp`; máximo **5 MB**. Errores devueltos con formato estándar.

## Texto enriquecido (bio de crew, descripción de series/películas, páginas)

- `crew_members.bio`, `series.description` y `pages.content` se editan con el
  mismo componente `RichTextEditor` (Tiptap: negrita, cursiva, tachado,
  enlaces, listas — sin imágenes incrustadas, decisión explícita) en
  `apps/web/src/components/admin/RichTextEditor.tsx`.
- El backend sanitiza el HTML al guardar (POST/PUT de `/admin/crew`,
  `/admin/series` y `/admin/pages`) con `sanitizeHtml` y las mismas
  `RICH_TEXT_SANITIZE_OPTIONS` en `admin.js` (etiquetas permitidas: `p, br,
  strong, b, em, i, s, u, a, ul, ol, li`; los enlaces fuerzan
  `rel="noopener noreferrer"`). Nunca confíes en HTML sin sanitizar de estos
  campos si añades un nuevo punto de entrada.
- Al mostrarlo en la web pública se renderiza con `dangerouslySetInnerHTML`
  dentro de un wrapper `.rich-editor .ProseMirror` (con `style` inline para
  igualar la tipografía del contexto) — así ya se hace en `/crew/[slug]` (bio),
  en `/serie/[id]` (descripción de la serie/película) y en las páginas fijas
  vía `StaticPageContent` (`apps/web/src/components/StaticPageLayout.tsx`).

## Envío de emails (SMTP)

- Backend: `backend/src/services/mail.js` (transporte Nodemailer + `sendMail`/
  `verifyMailConnection`, sin cambios en esta capa) + dos capas de plantillas:
  - `backend/src/services/mailLayout.js` — **motor de maquetación**, una única
    función `renderEmailLayout({...})` que genera el HTML (tabla + estilos
    inline, sin flexbox/grid, para que se vea bien en Gmail/Outlook) común a
    todos los emails. Bloques, todos opcionales salvo el header y el
    eyebrow/título/cuerpo: hero (`heroImageUrl`), cita del mensaje original
    (`quoteText`, solo en la respuesta a contacto), botón CTA (`button`),
    enlace de respaldo en texto plano (`linkFallback`), nota de
    caducidad/seguridad (`note`), lista de ventajas con check (`perks`, solo
    en bienvenida), despedida de 2 líneas y footer (redes, enlaces legales,
    baja). También exporta `escapeHtml`. El logo se sirve siempre desde
    `https://app.carppartners.tv/carp-partners-logo blanc.png` (fijo a
    producción, nunca `PUBLIC_WEB_URL`: un cliente de correo real no puede
    cargar una imagen en `localhost`).
  - `backend/src/services/mailTemplates.js` — **contenido**, una función por
    tipo de email que llama a `renderEmailLayout` con sus textos: `welcomeEmail`,
    `passwordResetEmail`, `setPasswordEmail`, `contactAdminNotification`,
    `contactAcknowledgmentEmail` (con `subject`/`message` opcionales para
    pintar el bloque de cita — sin botón, decisión explícita: no existe
    pantalla de seguimiento de consultas), `paymentFailedEmail`,
    `subscriptionCancelledEmail` y `subscriptionEndedEmail` (las tres
    conectadas al webhook de Stripe, ver más abajo), y `emailVerificationEmail`,
    redactada pero **sin disparador todavía** (no hay flujo de verificación de
    email al registrarse).
  Es **SMTP de una cuenta de correo normal** (`info@carppartners.tv` en
  hosting externo), no un proveedor tipo Resend/SendGrid.
- Todo el bloque `mail` de `config/index.js` es **opcional** (no `required()`):
  si falta `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, el backend arranca igual,
  `verifyMailConnection()` solo loguea un aviso, y `sendMail()` omite el envío
  (loguea y devuelve `{ sent: false }`) en vez de lanzar. Ningún flujo de la
  app (registro, contacto, alta de suscriptor...) debe depender de que el
  email realmente salga para completar su respuesta al usuario.
- Variables de entorno nuevas (ver `backend/.env.example`): `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`,
  `MAIL_ADMIN`, y `PUBLIC_WEB_URL` (para construir los enlaces de los emails;
  distinta de `PUBLIC_URL`, que sigue usándose para CORS/Stripe — en
  producción `PUBLIC_WEB_URL=https://app.carppartners.tv`).
- Las plantillas escapan siempre los campos que pueden venir de un usuario
  (nombre, mensaje de contacto...) antes de interpolarlos en HTML —
  ver `escapeHtml` en `mailLayout.js` (reexportado desde `mailTemplates.js`).
  Si añades una plantilla nueva con datos de usuario, no lo olvides.
- Disparadores actuales (todos "fire-and-forget": no se espera el envío antes
  de responder al cliente): `welcomeEmail` en `POST /auth/register`;
  `passwordResetEmail` en `POST /auth/forgot-password`; `setPasswordEmail` en
  `POST /admin/users` cuando se crea sin `password` (el token también se
  sigue devolviendo en la respuesta, como respaldo manual); `contactAdminNotification`
  (a `MAIL_ADMIN`) + `contactAcknowledgmentEmail` (al remitente) en `POST /contact`;
  `paymentFailedEmail` en `routes/stripe.js` al recibir `invoice.payment_failed`
  con `attempt_count === 1` (solo en el PRIMER intento fallido de cada factura
  — Stripe reintenta varias veces con Smart Retries y volvería a disparar el
  evento en cada reintento; con este filtro se avisa una vez, no una por
  reintento), enlaza a `${PUBLIC_WEB_URL}/perfil` (gestionar pago vía el
  Customer Portal). `subscriptionCancelledEmail` en `customer.subscription.updated`
  cuando `cancel_at_period_end` pasa de `false` a `true` (se compara contra el
  valor guardado en BD antes de actualizarlo) — deliberadamente NO en
  `customer.subscription.deleted`: el texto de esta plantilla ("mantienes el
  acceso hasta el final del periodo") solo es cierto en el momento en que se
  programa la cancelación, no cuando ya se ha hecho efectiva; enlaza también a
  `/perfil` (con la suscripción todavía vigente, `POST /billing/checkout` la
  rechazaría con `ALREADY_SUBSCRIBED`, así que reactivar pasa por el Customer
  Portal, no por un checkout nuevo). `subscriptionEndedEmail` (tono winback) en
  `customer.subscription.deleted` — el momento en que la baja SÍ es efectiva y
  el acceso ya se ha cortado; enlaza a `/planes` en vez de `/perfil` porque en
  este punto la suscripción ya no está vigente y sí se puede volver a hacer un
  checkout nuevo. Los tres resuelven destinatario buscando al usuario por
  `stripe_customer_id` (`findUserByCustomerId` en `routes/stripe.js`); el de
  `customer.subscription.deleted` además comprueba que el `status` en BD no
  fuera ya `'cancelled'` antes de escribir, para no reenviar el email si Stripe
  reintenta la entrega del mismo evento. `emailVerificationEmail` sigue sin
  conectar (no hay flujo de verificación de email al registrarse) — conéctala
  solo si se pide explícitamente.
- **`invoice.payment_succeeded` vs `invoice.paid`:** el endpoint de webhook
  real (comprobado vía API, `stripe.webhookEndpoints.list()`) tiene habilitado
  `invoice.payment_succeeded`, no `invoice.paid` — son eventos con nombre
  distinto. El código acepta ambos (`case 'invoice.paid': case
  'invoice.payment_succeeded':` en `routes/stripe.js`) para no depender de cuál
  esté configurado. Si en algún momento cambias los eventos habilitados en el
  Dashboard de Stripe, revisa primero `stripe.webhookEndpoints.list()` antes de
  asumir el nombre del evento — ya hubo un caso real de un `case` que nunca se
  ejecutaba porque el nombre no coincidía con lo que el endpoint enviaba de
  verdad. Punto preparado (sin implementar) para un futuro email de recibo de
  renovación: distinguir con `invoice.billing_reason === 'subscription_cycle'`
  (la primera factura es `'subscription_create'`, ya cubierta por
  `welcomeEmail`/el checkout).
- Los emails nativos de Stripe (avisos de pago fallido, etc.) vienen en inglés
  y sin la marca — se han desactivado a favor de los propios
  (Dashboard → Settings → Billing → Subscriptions and emails, por modo
  test/live). El **dunning** (reintentos automáticos tras un pago fallido) es
  configuración de cuenta de Stripe, no de este código, y solo se gestiona
  desde el Dashboard (no hay endpoint de API para leerlo ni escribirlo).
  Importante si se toca: `mapStripeStatus` (`services/stripe.js`) trata el
  estado `unpaid` de Stripe igual que `past_due` (sigue dando acceso) — hay
  que dejar configurado "Cancel the subscription" tras agotar los reintentos
  (no "mark as unpaid but keep active"), si no una suscripción impagada podría
  conservar el acceso indefinidamente al no llegar nunca el evento que la
  cancela de verdad.

## Formulario de contacto y bandeja admin

- `contact_messages` (migración 011): `name, email, subject?, message, read_at, created_at`.
  `POST /contact` (público, rate-limited en `app.js`) guarda la fila y dispara
  los dos emails de arriba; `read_at` empieza `NULL`.
- Panel admin `/admin/mensajes`: pestañas "Todos"/"No leídos", clic en una fila
  abre el detalle y lo marca leído automáticamente (`PUT /admin/contact-messages/:id`);
  desde el detalle se puede volver a marcar no leído, eliminar, o responder
  por email directo (`mailto:`).

## Reglas para el agente

1. No modifiques el contrato del backend ni el esquema de BD sin marcarlo
   explícitamente y explicar por qué.
2. Antes de crear una pantalla, comprueba qué endpoint la alimenta (tabla de
   arriba). Si falta un endpoint, dilo en vez de inventar datos.
3. Trabaja en incrementos verificables: deja la web arrancando (`npm run dev`)
   tras cada bloque y describe cómo probar lo hecho.
4. No introduzcas dependencias de pago ni servicios SaaS no contemplados en el
   briefing (sección 8). Si crees que hace falta uno, propónlo, no lo añadas.
5. Datos sensibles solo vía variables de entorno; nunca en el código ni en git.

## Hoja de ruta restante

- **Semana 4** (actual): web Next.js — Landing, Login, Home, Reproductor + `api-client` + `packages/ui`.
- **Semana 5**: app móvil Expo (mismas pantallas, reproductor nativo, push FCM).
- **Semana 6**: panel admin UI (dashboard, vídeos con subida a Vimeo, suscriptores, pagos).
- **Semana 7**: Explorar, Mi Lista, Perfil (Customer Portal), onboarding.
- **Semana 8**: notificaciones push admin, ajustes, export CSV, emails (Resend).
- **Semana 9**: QA en dispositivos reales, bugs, rendimiento.
- **Semana 10**: publicación App Store (TestFlight) y Google Play (Internal), go-live.
