-- Registro de envíos de campañas de email puntuales (no transaccionales) —
-- p. ej. el lanzamiento de la nueva plataforma. Permite que scripts/send-
-- launch-campaign.js sea idempotente: antes de enviar, comprueba si ya hay
-- una fila (user_id, campaign); si el script se corta a mitad y se relanza,
-- no reenvía a quien ya lo recibió.
CREATE TABLE IF NOT EXISTS email_campaign_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign   TEXT NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, campaign)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_log_campaign ON email_campaign_log(campaign);
