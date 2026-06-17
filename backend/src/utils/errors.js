// =====================================================================
// Errores HTTP tipados + wrapper para handlers async.
// Permite hacer `throw new HttpError(403, 'Sin suscripción')` en cualquier
// punto y que el middleware de errores responda con el código correcto.
// =====================================================================

export class HttpError extends Error {
  /**
   * @param {number} status  Código HTTP
   * @param {string} message Mensaje legible
   * @param {string} [code]  Código de error machine-readable (para el cliente)
   */
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code ?? null;
  }
}

// Atajos comunes
export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'No autenticado', code) => new HttpError(401, msg, code);
export const forbidden = (msg = 'Acceso denegado', code) => new HttpError(403, msg, code);
export const notFound = (msg = 'No encontrado', code) => new HttpError(404, msg, code);

/**
 * Envuelve un handler async para que los errores lleguen a next() sin
 * try/catch repetido en cada ruta.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
