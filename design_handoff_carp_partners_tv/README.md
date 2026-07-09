# Handoff: Carp Partners TV — Streaming Platform UI

> Developer handoff package. Prepared June 2026.
> Target stack (per briefing §5): **React Native + Expo**, one codebase for **Web + iOS + Android**. **Mobile-first** (design base 375px), adapts up to tablet (768px) and desktop (1280/1440px). **Dark mode by default.**

---

## 1. Overview

Carp Partners TV is the first carpfishing-specialized video streaming platform in Spain (Netflix-style: weekly 20–40 min HD videos, subscription-based, audience mostly men 25–55 across Spain & Europe). It replaces the current WordPress site and launches simultaneously as web + iOS + Android from the same React Native + Expo codebase.

This package documents a **high-fidelity, interactive prototype** of the core subscriber experience (desktop-web layout) plus the full design system, so a developer can recreate it in the real codebase and then build out the remaining screens listed in §9.

## 2. About the design files

The files in `prototype/` are **design references built in HTML/JS** — they show the intended look, layout, motion and interaction. **They are not production code to copy.** The task is to **recreate these designs in the target React Native + Expo codebase**, using its established patterns, navigation library and component conventions. Translate the HTML/CSS into RN primitives (`View`, `Text`, `Pressable`, `FlatList`, `Image`, `expo-av` `Video`, etc.); do not embed the HTML.

Because the prototype was authored on desktop-web, **treat it as the visual/interaction spec and re-flow it mobile-first** per the responsive rules in §8. The bottom tab bar (app) and top navbar (web) are described in §7.

### How to open the prototype
Open `prototype/Carp Partners TV.dc.html` in a modern browser (it loads its tiny runtime `support.js` from the same folder, plus Google Fonts + Tabler Icons from CDN — needs internet on first load). Click around: navbar, video cards, the player, search, Mi Lista all work.

## 3. Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows and interactions are all specified below and should be reproduced faithfully — adapted to each platform's idioms and re-flowed for mobile per §8.

---

## 4. Design tokens

### 4.1 Color

The briefing proposed navy + water-green; the client has since provided the **corporate color `#68140b`** (deep brick red / granate), which this design adopts as the brand accent. Imagery (thumbnails) stays naturalistic (water/dawn/forest) — brand red is reserved for UI chrome.

| Token | Hex | Role |
|---|---|---|
| `bg` | `#06090c` | App background (near-black, very slightly cool) |
| `surface` | `#0e151a` | Menus, popovers, "next up" card |
| `surface-2` | `rgba(255,255,255,0.05)` | Search field, chips, tag pills (on dark) |
| `brand` (accent) | `#68140b` | Primary fills: CTA buttons, active filter chip. **Text on it: `#ffffff`.** |
| `brand-bright` (accentBright) | `#cf4a35` | Brand red for **text/icons/lines on dark**: section kickers, progress bars, "98% para ti", saved-icon, empty-state icon. (Deep `#68140b` is too dark for text on near-black; this is the legible sibling, same hue family.) |
| `gold` | `#e3bd72` (text) / `rgba(216,166,74,0.95)` (fill) | Premium / "Nuevo" badge & "Nueva temporada" hero badge only |
| `text-primary` | `#ffffff` / `#eef3f0` / `#e9efeb` | Titles, primary copy |
| `text-secondary` | `#cdd6d2` / `#c4d0cb` | Body copy, descriptions |
| `text-muted` | `#85958e` / `#9aa9a3` | Metadata, captions, inactive nav |
| `text-faint` | `#7d8d86` / `#5f6f69` | Labels, separators, dots |
| `border` | `rgba(255,255,255,0.07)` → `0.2` | Card edges (.07), buttons/inputs (.1–.2) |
| `error` | `#E53E3E` | Failed payment / error messages (from briefing — not yet used in prototype) |
| `success` | `#38A169` | Confirmations (from briefing — not yet used) |

> Note: the briefing requires color tokens to work on **both dark and light** backgrounds (light mode is phase 2). Define both sets; only dark is designed here.

### 4.2 Typography

Two families, both Google Fonts (free for commercial use). Load via Google Fonts / `expo-font`.

| Role | Family | Weights |
|---|---|---|
| Display / headings | **Sora** | 600, 700, 800 |
| Body / UI | **Inter** | 400, 500, 600, 700 |

Type scale (desktop values — scale down for mobile, keep the hierarchy):

| Element | Font | Size / line-height / tracking / weight |
|---|---|---|
| Hero title (home) | Sora | 62px / 1.02 / −0.02em / 800 |
| Detail title | Sora | 50px / 1.05 / −0.02em / 800 |
| Page title (Explorar, Mi Lista) | Sora | 34px / 1.1 / −0.02em / 700 |
| Row / section heading | Sora | 19px / 600 |
| Section kicker (detail, uppercase) | Inter | 12.5px / 0.1em / 600, color `brand-bright` |
| Body / synopsis | Inter | 15.5–16px / 1.6–1.7 / 400 |
| Card title | Inter | 13.5px / 600 |
| Card meta | Inter | 11.5px / 400, color `text-muted` |
| Nav link | Inter | 13.5px / 500 |
| Button label | Inter | 14.5–15px / 600–700 |
| Player timecode | Inter | 13px, tabular-nums |

### 4.3 Spacing, radius, shadow, motion

- **Page horizontal padding:** 48px (desktop). Mobile: 16–20px.
- **Row item gap:** 16px. **Grid gap:** ~18–24px. **Section vertical rhythm:** 36px between home rows.
- **Radii:** cards 11px · buttons 9px · chips/tags 7–8px · badges 5–6px · menu/popover 12px · avatar/circle buttons 50%.
- **Shadows:** card `0 6px 22px rgba(0,0,0,0.4)` · primary button glow `0 6px 22px rgba(104,20,11,0.55)`.
- **Motion (keep subtle, per briefing §5.2):** card hover lift `translateY(-5px)` 0.25s ease · button hover `scale(1.03)` 0.15s · screen/element fade-in `opacity+translateY(10px)` ~0.3s · menu/"next up" fade 0.18–0.4s. No elaborate transitions.
- **Touch targets:** min 44×44px (Apple HIG) — circle icon buttons in the prototype are 38–46px; bump to ≥44 on mobile.
- **Thumbnail ratio:** **16:9 mandatory** for every video image.

### 4.4 Iconography
**Tabler Icons** (stroke style; filled only for active states). Icons used: `search`, `chevron-down`, `chevron-right`, `arrow-left`, `player-play-filled`, `player-pause-filled`, `rewind-backward-10`, `rewind-forward-10`, `volume` / `volume-2` / `volume-off`, `maximize` / `minimize`, `badge-cc`, `settings`, `info-circle`, `sparkles`, `plus`, `check`, `thumb-up`, `share-2`, `bookmark`, `compass`, `user`, `logout`, `circle-check-filled`, `mood-empty`, `fish`. Base size 24px mobile / 20px web.

---

## 5. Components (built in prototype)

### Button
- **Primary:** bg `brand` `#68140b`, text `#fff`, radius 9px, padding ~13×28px, icon + label, shadow `0 6px 22px rgba(104,20,11,0.55)`, hover `scale(1.03)`.
- **Secondary / glass:** `rgba(255,255,255,0.1)` bg + `1px rgba(255,255,255,0.2)` border, text `#fff`, blur backdrop; hover bg `0.18`.
- **Icon circle (ghost):** 44–46px circle, `1px rgba(255,255,255,0.2)` border, hover bg `rgba(255,255,255,0.08)`.
- Briefing also needs: Danger, Disabled, Loading variants (build in codebase).

### VideoCard (`prototype/VideoCard.dc.html`)
16:9 thumbnail, radius 11px, bottom gradient scrim, hover lift. Variants (all present): **normal**, **with progress** (4px bar at bottom, fill `brand-bright`), **with "Nuevo" badge** (top-left, gold), **with rank number** (large stroked numeral, for "Tendencias"). Overlays: duration pill (top-right), play circle (bottom-right, appears as affordance). Below: title (1 line, ellipsis) + meta line (series · episode, or category). Card width 300px in scroll rows; grids use `minmax(252px, 1fr)`.

### Row
Section heading (Sora 19px) + "Ver todos ›" link, then a horizontal-scroll track of VideoCards (scrollbar hidden). On mobile this is a `FlatList horizontal`.

### Player (full-screen)
Top bar: back circle + kicker/title. Center: big play/pause circle (88px, glass). Bottom: scrubber (6px track, fill `brand-bright`, draggable 14px knob) + controls row: play/pause, −10s, +10s, volume (toggle + 84px slider), timecode `m:ss / m:ss`, speed cycle (0.5/1/1.25/1.5/2×), CC, settings, fullscreen. "A continuación" (next-up) card slides in bottom-right after 60% progress → click autoplays next. Layered gradient vignette over the (placeholder) video.

### Badge / Tag
- "Nuevo": gold fill, dark text, uppercase 10px.
- "Nueva temporada" hero badge: gold text on `rgba(216,166,74,0.16)` + gold border, with `sparkles` icon.
- Metadata pills (4K UHD, +12): `1px rgba(255,255,255,0.28)` border.
- Tag chips (detail): `surface-2` bg + faint border, `text-muted`.
- "Plan Anual activo": `brand-bright` text on `rgba(104,20,11,0.2)` with `circle-check-filled`.

### Navbar (web top)
Sticky, gradient-to-transparent background + blur. Logo (left) · Inicio / Explorar / Mi Lista (active = white, inactive = muted) · search icon · avatar + chevron → dropdown menu (profile header with plan badge, Perfil, Ajustes, Cerrar sesión).

### Avatar
36px circle, warm gradient `linear-gradient(135deg,#5a241d,#2a1411)` + faint border, initials "DR" (Sora 600). Image variant when available.

### Filter chips (Explorar)
Pill, 8×16px padding. Active: `brand` fill + white text. Inactive: `surface-2` + faint border + `text-secondary`.

### Search input
`surface-2` bg, `1px border .1`, radius 12px, leading `search` icon, live filtering.

### Empty states
Centered: 76–80px circle icon (Mi Lista uses `bookmark` in `brand-bright` on red-tint; search uses `mood-empty` muted) + Sora title + muted explainer + (Mi Lista) a primary CTA to Explorar.

> Still to build per briefing §2.4: form Input (default/focus/error/disabled), Modal (confirm/error/info), Spinner, Toast, bottom Tab Bar — see §9.

---

## 6. Screens (built in prototype)

> Two prototype files: `Carp Partners TV.dc.html` (subscriber app — the screens below from Home through Mi Lista) and `Carp Partners — Landing.dc.html` (public/marketing — Landing, Login, Register).

### Landing (public, logged-out) — `Carp Partners — Landing.dc.html`
- **Purpose:** convert visitors into subscribers.
- **Sections (in order):** fixed nav (logo · Catálogo / Planes / Preguntas anchor links · Iniciar sesión · Suscríbete) → centered **hero** (gold eyebrow badge, 74px Sora headline, subcopy, primary "Empezar ahora" + glass "Ver catálogo", trust row: cancela / dispositivos / 4K) → **stats strip** (4 cards) → **features** (3 cards: series, técnicas, multidispositivo) → **catálogo preview** (two rows of 16:9 placeholders, blurred + masked, with a lock overlay + "Suscríbete para ver todo el catálogo" CTA) → **planes** (Mensual/Anual billing toggle with −33% badge; Gratis vs Premium cards, Premium highlighted "RECOMENDADO") → **testimonios** (3 rated cards) → **FAQ** (5-item accordion, single-open) → **CTA band** (granate gradient) → **footer** (logo + tagline + social + 3 link columns + legal). Nav links smooth-scroll to sections.
- **Notes:** brand-red accents on dark; gold reserved for premium/badges. Recreate the blurred preview with real catalog stills later.

### Login — `Carp Partners — Landing.dc.html` (screen `login`)
- Centered glass card over atmospheric gradient. Logo + "Volver al inicio" top bar. Fields: email, password (with show/hide eye). Row: "Recordarme" checkbox + "¿Olvidaste tu contraseña?". Primary "Iniciar sesión". Divider → Google / Apple social buttons. Footer: "¿Aún no tienes cuenta? Suscríbete" toggles to register. Input focus state = brand-red border.

### Registro — `Carp Partners — Landing.dc.html` (screen `register`)
- Same card; adds "Nombre completo" field and a live **password-strength meter** (4 segments, red→amber→green). Primary "Crear cuenta" + legal microcopy. Toggles back to login. (Recuperar/Establecer contraseña still to build — see §9.)

### Home
- **Purpose:** main screen after login; primary discovery surface.
- **Layout:** full-bleed hero (84vh) at top, navbar overlapping it; below, a vertical stack of horizontal-scroll rows; 48px side padding.
- **Hero:** "Nueva temporada" gold badge → title (Sora 62/800) → meta line (year · serie · episodes · 4K UHD) → synopsis (max 500px) → **Ver ahora** (primary) + **Más info** (glass). Right side: mute toggle + age pill. Dual gradient scrims (left + bottom) keep text legible over imagery.
- **Rows (in order):** Continuar viendo (progress bars) · Estrenos de la semana (Nuevo badges) · Tendencias en Carp Partners (rank 1–8) · Técnicas y montajes · Series · Documentales · El Podcast del Carp.

### Detalle de vídeo
- **Purpose:** pre-play screen with full info.
- **Layout:** 66vh hero header with back button (top-left), kicker + title + rating/meta row over the still; below a two-column block (main 1fr + side 300px): main = action row (**Reproducir** primary, **Mi Lista** toggle, like, share) + synopsis + tag chips; side = metadata (serie, categoría, duración, presenta). Then "Más como esto" responsive grid.
- **Mi Lista toggle:** swaps `plus`→`check`, label "Mi Lista"→"En tu lista", icon turns `brand-bright`.
- **Rating dialog (Netflix-style):** clicking the thumb-up circle button opens a centered modal (dark blurred scrim, click-outside or × to close). Three options side by side: **thumb-down** "No es para mí", **thumb-up** "Me gusta", **double thumb-up** "Me encanta" (two thumb icons overlaid at a slight angle). Selecting one fills its circle `brand` red with a white icon and shows a short confirmation line; clicking the same option again deselects. Rating is stored per video (`state.ratings[videoId]`) and persists back on the detail page — the thumb button itself turns filled/red once a rating exists. Tap targets 56px circles, dialog max-width 440px, radius 20px.

### Reproductor — see §5 Player. Returns to the screen it was launched from.

### Perfil
- **Purpose:** account management, reached from the navbar avatar dropdown (single "Perfil" entry — no separate settings screen).
- **Layout:** left sidebar (avatar + name + email + "Editar perfil", then 3 tab items + "Cerrar sesión") + right content pane with 3 tabs:
  - **Cuenta y suscripción** — current plan card (badge, price, renewal date, "Gestionar suscripción" → Stripe Customer Portal) + account data (email, change-password link, masked payment method).
- **Layout:** left sidebar (avatar + name + email, "Editar perfil", then 3 tab items + "Cerrar sesión") + right content pane with 3 tabs:
  - **Cuenta y suscripción** — current plan card (badge, price, renewal date, "Gestionar suscripción" → Stripe Customer Portal) + account data (email read-only, change-password link, masked payment method).
  - **Historial** — recently-watched list: thumbnail, title, relative date, duration.
  - **Notificaciones** — 4 toggle rows (estrenos, recomendaciones, promos, push) with a working on/off switch component (42×24px pill, sliding 20px knob, `brand-bright` when on).
- **Editar perfil:** toggles the sidebar card into an inline form editing **name and photo only**. Email is intentionally locked — it's the identifier tied to the Stripe subscription/billing record, so changing it here would desync payment records; the form shows a small lock note explaining this instead of an input. Saving updates the name everywhere (sidebar, navbar avatar initials, dropdown header) and shows a brief confirmation.

### Explorar
- **Purpose:** search + discovery.
- **Layout:** page title → search field (max 560px) → filter chips (Todo · Técnicas · Series · Documentales · Podcast) → result count → responsive grid of VideoCards, or empty state. Filtering is live (title/series/category match + category chip), instant results.

### Mi Lista
- **Purpose:** saved videos.
- **Layout:** title + count → grid of saved VideoCards, or empty state with CTA. Populated by the detail-screen toggle.

---

## 7. Navigation & information architecture

**Web (top navbar):** Logo · Inicio / Explorar / Mi Lista · expandable search · avatar dropdown (Perfil, Ajustes, Cerrar sesión). Implemented in prototype.

**App (bottom tab bar, 5 tabs, always visible)** — build this for mobile:
1. `home` — Inicio · 2. `compass`/`search` — Explorar · 3. **`play-circle` (center, emphasized)** — quick access to last watched · 4. `bookmark` — Mi Lista · 5. `user` — Perfil.

**Critical flows (optimize):**
- *Ver un vídeo:* Home → tap thumbnail → Detalle → Reproducir → Player (**≤2 taps to playback**).
- *Continuar viendo:* Home → "Continuar viendo" row → resume (**1 tap**).
- *Buscar:* Explorar → type → filter → result → play.
- *Suscripción nueva:* Landing → Planes → Stripe (external) → Confirmación → Home.
- *Gestionar suscripción:* Perfil → "Gestionar suscripción" → Stripe Customer Portal.

---

## 8. Responsive behavior (mobile-first)

Design base **375px**, verify at **430px**, adapt at **768px** (tablet, 2-col grids where sensible) and **1280/1440px** (web, full navbar layout).

- **Hero:** full-width; on mobile reduce title to ~32–36px, stack badge/title/synopsis, buttons full-width or side-by-side. Keep gradient scrims.
- **Rows:** horizontal `FlatList`; show ~1.3 cards peeking on mobile so users learn to scroll. Card width ~70–78vw mobile.
- **Detail two-column → single column** on mobile (metadata below synopsis).
- **Player:** 100% width on mobile/tablet; desktop may keep side info. Controls: ensure ≥44px targets; consider tap-to-toggle overlay.
- **Grids:** `minmax(252px,1fr)` desktop → 2 columns tablet → 1–2 columns mobile.
- Long titles truncate with `…` (test short AND long titles).

---

## 9. What's missing — still to build (from briefing §3)

The prototype covers the **core subscriber loop**. The following are specified in the briefing but **not yet designed** — build them in the codebase using the tokens/components above, mobile-first, dark mode:

**Public (logged-out):** **Landing page** — hero teaser, 3-point value prop, blurred catalog preview, plans & pricing, testimonials, FAQ, footer.
- **Página de planes** — Mensual vs Anual comparison, highlight annual savings, CTAs, benefits list, payment FAQ.
- **Login** — email + password, Entrar, "Olvidé mi contraseña", link to plans.
- **Recuperar contraseña** — email field → confirmation screen.
- **Establecer contraseña** (migrated users) — new password + confirm, strength meter.
- **Landing page** — ✅ built (`Carp Partners — Landing.dc.html`).
- **Página de planes** — covered as the Planes section of the landing; build a standalone full comparison page if needed (payment FAQ, annual savings detail).
- **Login** — ✅ built. **Registro** — ✅ built.
- **Recuperar contraseña** — email field → confirmation screen. *(to build)*
- **Establecer contraseña** (migrated users) — new password + confirm, strength meter (meter component already designed in Registro). *(to build)*

**Subscriber:**
- **Perfil** — ✅ built (single screen: Cuenta y suscripción / Historial / Notificaciones tabs + inline name/photo editing). See §6.

**Onboarding:**
- **Bienvenida** — name, welcome, category preview, "Empezar a ver".
- **Notificaciones** (app only) — illustration, value prop, "Activar notificaciones" / "Ahora no".

**Admin panel** (different aesthetic: light bg, high density, functional — not cinematic):
- **Dashboard** (4 metric cards: subs, MRR, plays today, last payments + 30-day chart + activity list)
- **Gestión de vídeos** (table, filters, upload + drag&drop, fields: title/desc/category/series/thumbnail)
- **Gestión de suscriptores** (paginated table, search, status filters, actions)
- **Historial de pagos** (Stripe transactions, date/status filters, monthly totals, CSV export)
- **Notificaciones push** (title + body, audience selector, preview, send)

**Component gaps (§2.4):** Button Danger/Disabled/Loading · form Input states · Spinner · Toast · bottom Tab Bar. (Modal ✅ built, as the rating dialog — reuse its scrim/card pattern for confirm/error/info modals.)

**Phase 2:** light mode (define light tokens now).

---

## 10. Assets

- `assets/carp-partners-logo.png` — horizontal wordmark (web-optimized, 1400px wide, transparent). Gray "CARP / PARTNERS" with maroon "S" emblem. Used in navbar at ~25px height.
- `assets/logo-original-full.png` — original full-res logo (14273×2478, transparent) for export of SVG/symbol/app-icon variants.
- **Still needed (briefing §5.3):** logo as **SVG** + symbol-only version (dark & light bg), app icon 1024×1024 (no rounded corners), splash 1242×2688, favicon (32 + 512), 16:9 thumbnail placeholder SVG, empty-state illustrations, color tokens JSON.
- **Thumbnails in prototype are placeholders** — 8 layered-gradient "moods" (dawn/river/forest/blue-hour/teal/night/amber/slate) standing in for real 16:9 footage stills. Replace with real catalog thumbnails (Unsplash only for mockups, never production).
- Fonts: Sora + Inter via Google Fonts. Icons: Tabler Icons.

---

## 11. Files in this package

```
design_handoff_carp_partners_tv/
├── README.md                          ← this document
├── CarpPartners_Briefing_UXUI.docx    ← original client briefing (full requirements)
├── assets/
│   ├── carp-partners-logo.png         ← web-optimized wordmark
│   └── logo-original-full.png         ← original full-res logo
└── prototype/
        ── Carp Partners TV.dc.html       ← main app (Home, Detail, Player, Explorar, Mi Lista) + logic & state├
    ├── Carp Partners TV.dc.html       ← subscriber app (Home, Detail, Player, Explorar, Mi Lista) + logic & state
    ├── Carp Partners — Landing.dc.html ← public site (Landing, Login, Registro) + logic & state
    ├── VideoCard.dc.html              ← reusable video card component
    └── support.js                     ← tiny runtime so the HTML opens in a browser (reference only)
```

**Brand color:** `#68140b` · **Bright sibling:** `#cf4a35` · **Fonts:** Sora + Inter · **Icons:** Tabler · **Stack:** React Native + Expo, mobile-first, dark mode.
