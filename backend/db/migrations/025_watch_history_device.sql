-- Carp Partners TV — Migración 025: dispositivo de cada reproducción
-- Permite el futuro desglose "vistas por dispositivo" del dashboard admin.
-- Derivado del header User-Agent (que el navegador ya manda en cada
-- petición) en POST /watch-history, parseado con ua-parser-js — no se
-- recoge nada nuevo del cliente. Nullable: las filas ya existentes se
-- quedan sin este dato (no se puede reconstruir con retroactividad).
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS device_type TEXT;
