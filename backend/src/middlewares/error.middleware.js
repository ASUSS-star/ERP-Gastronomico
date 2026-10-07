/**
 * Manejo CENTRALIZADO de errores.
 * Toda excepción (lanzada o rechazada en un async) termina aquí.
 * Express 5 reenvía automáticamente las promesas rechazadas a este middleware.
 */
const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const env = require('../config/env');

/** Traduce errores conocidos de librerías a AppError con status HTTP correcto. */
const normalizarError = (err) => {
  if (err instanceof AppError) return err;

  // --- JWT ---
  if (err.name === 'TokenExpiredError') return AppError.unauthorized('El token ha expirado, inicia sesión de nuevo');
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') return AppError.unauthorized('Token inválido');

  // --- JSON mal formado en el body ---
  if (err.type === 'entity.parse.failed') return AppError.badRequest('El cuerpo de la petición no es un JSON válido');
  if (err.type === 'entity.too.large') return new AppError('El cuerpo de la petición es demasiado grande', 413);

  // --- Prisma ---
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const campos = [].concat(err.meta?.target || []).join(', ');
        return AppError.conflict(`Ya existe un registro con ese valor único${campos ? ` (${campos})` : ''}`);
      }
      case 'P2025':
        return AppError.notFound('El registro solicitado no existe');
      case 'P2003':
        return AppError.conflict('No se puede completar: el registro está relacionado con otros datos');
      default:
        break;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return AppError.badRequest('Datos inválidos para la base de datos');
  }

  return null; // error desconocido → 500
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const appError = normalizarError(err);

  if (!appError) {
    // Bug real: se registra completo en el servidor, pero NO se filtra al cliente
    console.error(`[ERROR 500] ${req.method} ${req.originalUrl}\n`, err);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor',
      ...(!env.isProd && { debug: err.message }),
    });
  }

  return res.status(appError.statusCode).json({
    ok: false,
    mensaje: appError.message,
    ...(appError.detalles && { errores: appError.detalles }),
  });
};

const notFoundHandler = (req, _res, next) => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

module.exports = { errorHandler, notFoundHandler };
