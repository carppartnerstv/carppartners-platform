-- =====================================================================
-- Migración 003: crew_members + video_crew
-- Añade el sistema de crew sin tocar tablas existentes.
-- =====================================================================

CREATE TABLE crew_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'crew'
                          CHECK (role IN ('socio', 'crew')),
  bio         TEXT,
  avatar_url  TEXT,
  order_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE video_crew (
  video_id        UUID REFERENCES videos(id)        ON DELETE CASCADE,
  crew_member_id  UUID REFERENCES crew_members(id)  ON DELETE CASCADE,
  PRIMARY KEY (video_id, crew_member_id)
);

-- Índice para "todos los vídeos de X persona"
CREATE INDEX idx_video_crew_member ON video_crew (crew_member_id);
