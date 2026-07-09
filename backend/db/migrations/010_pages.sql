CREATE TABLE IF NOT EXISTS pages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    content           TEXT,
    meta_title        TEXT,
    meta_description  TEXT,
    og_image          TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_pages_updated
    BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO pages (slug, title, content) VALUES
    ('sobre-carp-partners',    'Sobre Carp Partners',    '<p>Contenido pendiente de redactar.</p>'),
    ('aviso-legal',            'Aviso legal',             '<p>Contenido pendiente de redactar.</p>'),
    ('politica-de-privacidad', 'Política de privacidad',  '<p>Contenido pendiente de redactar.</p>'),
    ('politica-de-cookies',    'Política de cookies',     '<p>Contenido pendiente de redactar.</p>'),
    ('terminos-de-uso',        'Términos de uso',         '<p>Contenido pendiente de redactar.</p>'),
    ('contacto',               'Contacto',                '<p>Contenido pendiente de redactar.</p>')
ON CONFLICT (slug) DO NOTHING;
