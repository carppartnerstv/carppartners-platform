-- Carp Partners TV — Migración 028: cuántos Customer de Stripe tiene cada
-- usuario con ese email (WordPress crea uno nuevo por alta/ciclo — ver
-- scripts/find-stale-customer-links.js). Se rellena con
-- scripts/flag-duplicate-stripe-customers.js (cron semanal), no en cada
-- request — consultar Stripe por cada fila del listado de suscriptores
-- sería demasiado lento. NULL = todavía no comprobado.
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_duplicate_count INTEGER;
