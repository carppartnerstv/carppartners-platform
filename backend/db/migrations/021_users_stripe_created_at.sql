-- Fecha real de alta como cliente en Stripe (customer.created), distinta de
-- users.created_at (que para los usuarios migrados es la fecha en que se
-- ejecutó la migración, no su antigüedad real). NULL hasta que
-- scripts/backfill-stripe-created-at.js la rellena para los ya migrados, o
-- hasta que migrate-stripe.js la fije en una futura migración de stragglers.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS stripe_created_at TIMESTAMPTZ;
