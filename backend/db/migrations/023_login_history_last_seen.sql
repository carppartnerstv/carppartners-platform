-- Añade last_seen_at a login_history, para poder calcular cuánto tiempo
-- estuvo conectado un usuario en cada sesión (logged_in_at -> last_seen_at).
-- Se rellena con un "heartbeat" periódico desde el navegador mientras la
-- pestaña está visible (POST /activity/heartbeat) — no con el logout, que
-- casi nadie pulsa de verdad (la gente simplemente cierra la pestaña).
-- NULL en filas antiguas (de antes de esta funcionalidad) o en sesiones
-- tan cortas que no llegó a mandarse ningún heartbeat — duración
-- desconocida en esos casos, no se inventa un valor.
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
