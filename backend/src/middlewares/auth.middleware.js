/**
 * Middleware de AUTENTICACIÓN.
 * 1. Lee el header  Authorization: Bearer <token>
 * 2. Verifica firma y expiración del JWT
 * 3. Confirma en BD que el usuario y su restaurante sigan activos
 *    (así un usuario dado de baja pierde acceso aunque su token no haya expirado)
 * 4. Deja en req.user: { id, nombre, email, rol, restauranteId }
 */
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { verificarToken } = require('../utils/jwt');

const autenticar = async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw AppError.unauthorized('Token no proporcionado. Usa el header Authorization: Bearer <token>');
  }

  // Errores de jwt (TokenExpiredError / JsonWebTokenError) los traduce el errorHandler a 401
  const payload = verificarToken(token);

  const usuario = await prisma.usuario.findUnique({
    where: { id: Number(payload.sub) },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      restauranteId: true,
      restaurante: { select: { activo: true, nombre: true } },
    },
  });

  if (!usuario || !usuario.activo) throw AppError.unauthorized('Usuario inexistente o desactivado');
  if (!usuario.restaurante.activo) throw AppError.forbidden('El restaurante está suspendido');

  const { activo, restaurante, ...datos } = usuario;
  req.user = { ...datos, restauranteNombre: restaurante.nombre };
  next();
};

module.exports = { autenticar };
