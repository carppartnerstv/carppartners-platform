// =====================================================================
// Subida de imágenes del panel admin y del perfil propio del usuario —
// avatar de crew, avatar de usuario, portada de serie/vídeo (horizontal
// y vertical), imagen de página y de carrusel. Antes esta lógica estaba
// duplicada en admin.js y auth.js (cada uno con su propia instancia de
// multer); se junta aquí en un único sitio para no repetirla, y de paso
// se añade el paso de redimensionado/compresión que faltaba: hasta ahora
// se guardaba el archivo que subía el admin tal cual (hasta 5 MB a su
// resolución original), aunque se mostrara en una tarjeta de 260px —
// de ahí imágenes pesadas cargando visiblemente despacio en la web.
// =====================================================================
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import { HttpError } from './errors.js';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Calidad 82 en jpeg/webp: sin pérdida apreciable a simple vista en fotos
// reales, pero recorta bastante el peso frente al 100% por defecto de
// cualquier cámara/móvil. `withoutEnlargement` evita agrandar (y pixelar)
// una imagen que ya viniera más pequeña que el máximo. `rotate()` sin
// argumentos aplica la orientación EXIF y la descarta — si no, una foto
// de móvil en vertical podía guardarse girada en algunos visores que no
// leen ese metadato.
async function compressImageInPlace(filePath, mimetype, { maxWidth, maxHeight }) {
  const pipeline = sharp(filePath)
    .rotate()
    .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true });

  const buffer = await (
    mimetype === 'image/png' ? pipeline.png({ compressionLevel: 9 })
    : mimetype === 'image/webp' ? pipeline.webp({ quality: 82 })
    : pipeline.jpeg({ quality: 82, mozjpeg: true })
  ).toBuffer();

  await fs.promises.writeFile(filePath, buffer);
}

/**
 * Middleware de subida de una sola imagen a `uploadsDir`, bajo el campo
 * `fieldName` del formulario. JPG/PNG/WebP, máx 5 MB de entrada — una vez
 * guardada, se redimensiona (si excede maxWidth/maxHeight) y se recomprime
 * en el mismo sitio, conservando el formato original.
 * @param {string} uploadsDir
 * @param {string} fieldName
 * @param {{ maxWidth?: number, maxHeight?: number }} [dimensions]
 */
export function makeImageUpload(uploadsDir, fieldName, { maxWidth = 1920, maxHeight = 1920 } = {}) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req,  file, cb) => {
      const ext    = path.extname(file.originalname).toLowerCase() || '.jpg';
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
      cb(null, unique);
    },
  });

  const instance = multer({
    storage,
    limits:  { fileSize: IMAGE_MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
      cb(new HttpError(400, 'Tipo no válido. Usa JPG, PNG o WebP.', 'INVALID_TYPE'));
    },
  });

  // Convierte errores de multer al formato estándar de la API, y de paso
  // comprime el archivo ya guardado antes de seguir.
  return function upload(req, res, next) {
    instance.single(fieldName)(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new HttpError(413, 'Imagen demasiado grande. Máximo 5 MB.', 'FILE_TOO_LARGE'));
        }
        return next(err instanceof HttpError ? err : new HttpError(400, err.message ?? 'Error de subida', 'UPLOAD_ERROR'));
      }
      if (!req.file) return next(); // campo opcional en este endpoint, nada que procesar

      try {
        await compressImageInPlace(req.file.path, req.file.mimetype, { maxWidth, maxHeight });
      } catch (compressErr) {
        // Fail-soft: si sharp falla por lo que sea, el archivo original
        // (ya guardado, válido) sigue ahí — no bloqueamos la subida por esto.
        console.error('[imageUpload] No se pudo comprimir la imagen, se deja la original:', compressErr.message);
      }
      next();
    });
  };
}
