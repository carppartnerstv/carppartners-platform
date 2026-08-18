-- =====================================================================
-- Carp Partners TV — Migración 014: series "seleccionadas" para la fila
-- de Home "Mejores seleccionados para ti".
-- Cubre: series.is_curated — a diferencia de videos.is_featured (destacado
-- único de portada, con índice único parcial), aquí puede haber varias
-- series marcadas a la vez, así que no lleva índice de unicidad.
-- =====================================================================

ALTER TABLE series
    ADD COLUMN IF NOT EXISTS is_curated BOOLEAN NOT NULL DEFAULT false;
