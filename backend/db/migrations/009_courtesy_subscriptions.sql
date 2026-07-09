ALTER TABLE subscriptions
    ALTER COLUMN stripe_sub_id DROP NOT NULL;

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe'
        CHECK (source IN ('stripe', 'courtesy'));

ALTER TABLE subscriptions
    ADD CONSTRAINT chk_subscriptions_source_consistency
        CHECK (
            (source = 'stripe'   AND stripe_sub_id IS NOT NULL) OR
            (source = 'courtesy' AND stripe_sub_id IS NULL)
        );
