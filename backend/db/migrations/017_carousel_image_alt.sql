-- Texto alternativo (accesibilidad/SEO) personalizable por imagen de
-- carrousel — nullable, las imágenes ya subidas simplemente no tienen.
ALTER TABLE carousel_images
    ADD COLUMN IF NOT EXISTS alt_text TEXT;
