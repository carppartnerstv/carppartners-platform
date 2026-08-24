-- Tracking de login real (para la métrica "han entrado a la plataforma" del
-- panel de Métricas de lanzamiento): NULL hasta el primer login correcto,
-- se actualiza en cada POST /auth/login exitoso.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
