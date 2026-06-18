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
├── scripts/              migración Stripe, resolver price_ids
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
auth JWT, esquema de BD (9 tablas), webhooks Stripe, proxy seguro de Vimeo,
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
| POST | `/auth/set-password` | token | `{ok}` |
| GET | `/videos?limit&offset&category&series&q` | JWT + suscripción | `{videos, limit, offset}` |
| GET | `/videos/:id` | JWT + suscripción | `{video, related}` |
| GET | `/videos/:id/stream` | JWT + suscripción | `{hlsUrl, expiresInSec}` |
| GET | `/categories` | JWT | `{categories}` |
| GET | `/series?category` | JWT | `{series}` |
| POST | `/watch-history` `{videoId,progressSec,completed?}` | JWT | 204 |
| GET | `/watch-history/continue` | JWT | `{items}` |
| GET | `/watchlist` | JWT | `{items}` |
| POST | `/watchlist/:videoId` | JWT | 201 |
| DELETE | `/watchlist/:videoId` | JWT | 204 |
| POST | `/push-tokens` `{token,platform}` | JWT | 201 |
| POST | `/billing/portal` | JWT | `{url}` |
| GET | `/admin/dashboard` | JWT + admin | `{activeSubscribers,publishedVideos,playsToday,mrr}` |
| GET | `/admin/users?status&q&limit&offset` | JWT + admin | `{users}` |
| GET | `/admin/payments` | JWT + admin | `{payments}` |
| POST/PUT/DELETE | `/admin/videos[/:id]` | JWT + admin | vídeo / 204 |
| GET | `/admin/videos?published&category&series&q&limit&offset` | JWT + admin | `{videos,limit,offset}` — incluye borradores |
| POST | `/admin/categories` `{name,slug,description?,coverUrl?,orderIndex?}` | JWT + admin | `{category}` 201 |
| PUT | `/admin/categories/:id` | JWT + admin | `{category}` |
| DELETE | `/admin/categories/:id` | JWT + admin | 204 |
| POST | `/admin/series` `{title,slug,description?,categoryId?,seasonNum?,coverUrl?,orderIndex?}` | JWT + admin | `{series}` 201 |
| PUT | `/admin/series/:id` | JWT + admin | `{series}` |
| DELETE | `/admin/series/:id` | JWT + admin | 204 |
| GET | `/admin/vimeo/:vimeoId/metadata` | JWT + admin | `{title,durationSec,thumbnailUrl}` — autorelleno formulario |
| GET | `/admin/crew` | JWT + admin | `{crew}` |
| POST | `/admin/crew` `{name,slug,role?,bio?,avatarUrl?,orderIndex?}` | JWT + admin | `{member}` 201 |
| PUT | `/admin/crew/:id` | JWT + admin | `{member}` |
| DELETE | `/admin/crew/:id` | JWT + admin | 204 |
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
de planes, no mostrar un error genérico.

## Rutas de la web (briefing 5.1)

| Ruta | Pantalla | Acceso |
|------|----------|--------|
| `/` | Landing (propuesta de valor, planes, login) | pública |
| `/login` | Login + registro | pública |
| `/home` | Home tipo Netflix: hero + filas por categoría | suscriptores |
| `/explorar` | Búsqueda y filtros (categoría, serie, duración) | suscriptores |
| `/watch/[id]` | Reproductor a pantalla completa + relacionados | suscriptores |
| `/mi-lista` | Vídeos guardados | suscriptores |
| `/perfil` | Datos, plan activo, enlace a Customer Portal de Stripe | suscriptores |
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
