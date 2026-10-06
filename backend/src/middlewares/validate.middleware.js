/**
 * Middleware de VALIDACIÓN con Joi.
 * Uso: validar({ body: esquema, params: esquema, query: esquema })
 * - abortEarly:false  → devuelve TODOS los errores, no sólo el primero
 * - stripUnknown:true → elimina campos no declarados (evita mass-assignment,
 *                        p. ej. que alguien mande "rol":"ADMIN" o "restauranteId")
 * - convert:true      → "5" → 5, "true" → true (útil para params y query)
 */
const AppError = require('../utils/AppError');

const opciones = { abortEarly: false, stripUnknown: true, convert: true };

const validar = (esquemas) => (req, _res, next) => {
  const errores = [];

  for (const parte of ['params', 'query', 'body']) {
    if (!esquemas[parte]) continue;
    const { error, value } = esquemas[parte].validate(req[parte] ?? {}, opciones);
    if (error) {
      errores.push(
        ...error.details.map((d) => ({
          campo: `${parte}.${d.path.join('.')}`,
          mensaje: d.message.replace(/"/g, ''),
        })),
      );
    } else if (parte === 'query') {
      // En Express 5 req.query es un getter de sólo lectura → lo redefinimos con el valor saneado
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true, enumerable: true });
    } else {
      req[parte] = value;
    }
  }

  if (errores.length) throw AppError.badRequest('Error de validación', errores);
  next();
};

module.exports = { validar };
