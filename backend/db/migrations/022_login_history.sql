-- Historial completo de inicios de sesión (POST /auth/login correcto),
-- distinto de users.last_login_at (que solo guarda el último momento, para
-- las consultas rápidas de "actividad reciente"/embudo de lanzamiento).
-- Esta tabla es el log completo, para el popup de detalle de suscriptor.
CREATE TABLE IF NOT EXISTS login_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address    TEXT,
    user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, logged_in_at DESC);
