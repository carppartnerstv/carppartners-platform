-- Preferencias de notificación del propio usuario (pestaña "Avisos" de
-- Perfil, web y mobile) — hasta ahora era solo estado local de React en
-- ambos frontends, nunca se guardaba. Un único JSONB por simplicidad: son
-- 4 flags fijos, sin necesidad de una tabla aparte ni de JOIN.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT
        '{"estrenos":true,"recomendaciones":true,"promos":false,"push":true}';
