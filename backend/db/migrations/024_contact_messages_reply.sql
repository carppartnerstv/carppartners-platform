-- Respuesta enviada desde el propio panel (/admin/mensajes), en vez de
-- depender del mailto: del navegador del admin. replied_at queda null
-- hasta la primera respuesta; reply_text guarda SOLO la última (no hace
-- falta un historial completo para el uso que se le da).
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS reply_text TEXT;
