// =====================================================================
// Middleware central de manejo de errores. Va al final de la cadena.
// Devuelve JSON consistente: { error: { message, code } }
// =====================================================================
import { HttpError } from '../utils/errors.js';
import { config } from '../config/index.js';

// eslint-disable-next-line no-unused-vars -- Express requiere los 4 args
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code },
    });
  }

  // Errores no controlados: log completo, respuesta genérica al cliente
  console.error('[error] No controlado:', err);
  return res.status(500).json({
    error: {
      message: config.isProd ? 'Error interno del servidor' : err.message,
      code: 'INTERNAL_ERROR',
    },
  });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Ruta no encontrada', code: 'ROUTE_NOT_FOUND' } });
}
