-- =====================================================================
-- Carp Partners TV — Migración 002: interacción de usuario
-- Cubre: watch_history, watchlist, push_tokens
-- Referencia: Briefing técnico v2.0, sección 3.1
-- =====================================================================

-- ------------------------------------------------------------------
-- watch_history — "Continuar viendo" + progreso por usuario
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watch_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id        UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    progress_sec    INTEGER NOT NULL DEFAULT 0,
    completed       BOOLEAN NOT NULL DEFAULT false,
    last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un único registro de progreso por (usuario, vídeo): se hace UPSERT
    UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_video ON watch_history(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_continue   ON watch_history(user_id, last_watched_at DESC);

-- ------------------------------------------------------------------
-- watchlist — favoritos / "Mi Lista"
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS watchlist (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    video_id  UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id, added_at DESC);

-- ------------------------------------------------------------------
-- push_tokens — tokens FCM para notificaciones push
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
