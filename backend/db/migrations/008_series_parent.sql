ALTER TABLE series
    ADD COLUMN IF NOT EXISTS parent_series_id UUID REFERENCES series(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_series_parent ON series(parent_series_id);
