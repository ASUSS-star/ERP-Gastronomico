/**
 * Middleware de AUTORIZACIÓN por roles.
 * Uso: router.post('/', autenticar, permitirRoles('ADMIN', 'MESERO'), controlador)
 * Debe ir SIEMPRE después de `autenticar`.
 */
const AppError = require('../utils/AppError');

const permitirRoles = (...rolesPermitidos) => (req, _res, next) => {
  if (!req.user) throw AppError.unauthorized();
  if (!rolesPermitidos.includes(req.user.rol)) {
    throw AppError.forbidden(
      `Acceso denegado: se requiere rol ${rolesPermitidos.join(' o ')} (tu rol: ${req.user.rol})`,
    );
  }
  next();
};

module.exports = { permitirRoles };
