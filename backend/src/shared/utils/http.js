/**
 * Envuelve un controlador async para que Express 4 reciba sus errores.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Respuesta estándar `{ data, meta }`.
 */
export function sendData(res, data, { status = 200, meta } = {}) {
  return res.status(status).json(meta === undefined ? { data } : { data, meta });
}
