// =====================================================================
// Páginas de contenido fijo (Sobre nosotros, legales, Contacto...).
//   GET /pages/:slug   contenido + SEO de una página — pública, sin login
// =====================================================================
import { Router } from 'express';
import { queryOne } from '../config/db.js';
import { asyncHandler, notFound } from '../utils/errors.js';

export const pagesRouter = Router();

pagesRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await queryOne(
      `SELECT slug, title, content, meta_title, meta_description, og_image, updated_at
         FROM pages WHERE slug = $1`,
      [req.params.slug],
    );
    if (!page) throw notFound('Página no encontrada', 'PAGE_NOT_FOUND');
    res.json({ page });
  }),
);
