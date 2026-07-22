-- =====================================================================
-- Migración 012: cancel_at_period_end
--
-- Cuando el usuario cancela desde el Customer Portal, Stripe NO cambia
-- `status` de inmediato (sigue 'active' hasta que termina el periodo ya
-- pagado) — solo marca cancel_at_period_end=true en la propia suscripción.
-- Sin guardar este campo, la web no podía distinguir "se renueva" de
-- "cancelada pero con acceso hasta tal fecha" hasta que la baja era
-- definitiva. Lo rellena el webhook (services/subscriptions.js).
-- =====================================================================
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
