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
| POST | `/auth/set-password` | token | `{ok}` |
| POST | `/auth/change-password` `{currentPassword,newPassword}` | JWT | `{ok}` — cambio de contraseña desde Perfil estando ya logueado (añadido 2026-07, ver Perfil) |
| PUT | `/auth/me` `{name}` | JWT | `{user}` — "Editar perfil"; el email NO es editable aquí (ligado a Stripe) |
| POST | `/auth/me/avatar` `multipart/form-data; field=avatar` | JWT | `{user}` — sube/reemplaza la foto propia (JPG/PNG/WebP, máx 5 MB) |
| DELETE | `/auth/me/avatar` | JWT | 204 |
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
| POST | `/billing/portal` | JWT | `{url}` |
| GET | `/admin/dashboard` | JWT + admin | `{activeSubscribers,publishedVideos,playsToday,mrr}` |
| GET | `/admin/users?status&q&limit&offset` | JWT + admin | `{users}` |
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
de planes, no mostrar un error genérico.

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
| `/login` | Login + registro | pública |
| `/home` | Home tipo Netflix: hero + filas por categoría, una tarjeta por serie/película (no vídeos sueltos) | suscriptores |
| `/explorar` | Sin búsqueda activa: tarjetas de serie/película por categoría. Con texto de búsqueda: vídeos sueltos que coinciden (como antes) | suscriptores |
| `/serie/[id]` | Detalle de una serie o película (portada, sinopsis, metadatos) + lista de episodios. Si la serie tiene temporadas (`GET /series/:id` → `seasons.length > 0`), muestra selector de temporada (por defecto la primera) y lista los episodios de la temporada elegida vía `GET /videos?series=<seasonId>`; si no, lista sus vídeos directamente vía `GET /videos?series=<id>`. Ruta única para series y películas (mismo modelo de datos). Clic en un episodio → `/watch/[id]` | suscriptores |
| `/watch/[id]` | Detalle del vídeo (sinopsis, Reparto, Mi Lista, relacionados) — clic en cualquier tarjeta lleva aquí | suscriptores |
| `/watch/[id]/play` | Reproductor a pantalla completa — solo se llega pulsando "Reproducir"/"Reanudar" desde el detalle | suscriptores |
| `/crew/[slug]` | Perfil de miembro de la crew (bio, "Vídeos con {nombre}") — se abre desde el Reparto del detalle | suscriptores |
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

## Subida de archivos (avatars de crew, portadas de series y de usuarios)

- Las imágenes se guardan en **`backend/uploads/crew/`** (avatar de crew),
  **`backend/uploads/series/`** (portada de serie/película, pensada para
  16:9 1920×1080) o **`backend/uploads/avatars/`** (foto de perfil del propio
  usuario, subida desde Perfil → Editar perfil) con nombre único
  (`<timestamp>-<random>.<ext>`). Los tres comparten la misma factory
  `makeImageUpload(uploadsDir, fieldName)` en `admin.js` (mismo `multer`,
  misma validación) — para añadir un cuarto tipo de imagen, reutiliza esa
  factory en vez de duplicar la configuración de `multer`.
- La carpeta **`backend/uploads/`** está en `.gitignore** y **debe incluirse en
  las copias de seguridad del servidor** (no está en el repositorio).
- El backend las sirve de forma estática en la ruta `/uploads/*` mediante
  `express.static` (solo esa carpeta, `index: false, dotfiles: 'deny'`).
- La URL pública almacenada en `crew_members.avatar_url` / `series.cover_url` /
  `users.avatar_url` usa el host del request (`req.protocol + '://' + req.get('host')`):
  - Dev: `http://localhost:3001/uploads/crew/<filename>`, `/uploads/series/<filename>` o `/uploads/avatars/<filename>`
  - Producción: requiere que Nginx tenga un `location /uploads/ { proxy_pass http://localhost:3001; }`.
- Al reemplazar o eliminar una imagen, el endpoint borra el archivo anterior del
  disco. Al eliminar la fila dueña (DELETE `/admin/crew/:id` o `/admin/series/:id`),
  también se borra su imagen del disco.
- `multer` gestiona la subida; validación: solo `image/jpeg`, `image/png`,
  `image/webp`; máximo **5 MB**. Errores devueltos con formato estándar.

## Texto enriquecido (bio de crew, descripción de series/películas)

- `crew_members.bio` y `series.description` se editan con el mismo componente
  `RichTextEditor` (Tiptap: negrita, cursiva, tachado, enlaces, listas) en
  `apps/web/src/components/admin/RichTextEditor.tsx`.
- El backend sanitiza el HTML al guardar (POST/PUT de `/admin/crew` y
  `/admin/series`) con `sanitizeHtml` y las mismas `RICH_TEXT_SANITIZE_OPTIONS`
  en `admin.js` (etiquetas permitidas: `p, br, strong, b, em, i, s, u, a, ul,
  ol, li`; los enlaces fuerzan `rel="noopener noreferrer"`). Nunca confíes en
  HTML sin sanitizar de estos campos si añades un nuevo punto de entrada.
- Al mostrarlo en la web pública se renderiza con `dangerouslySetInnerHTML`
  dentro de un wrapper `.rich-editor .ProseMirror` (con `style` inline para
  igualar la tipografía del contexto) — así ya se hace en `/crew/[slug]` (bio)
  y en `/serie/[id]` (descripción de la serie/película).

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
