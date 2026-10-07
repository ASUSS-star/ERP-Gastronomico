/**
 * Error de negocio con código HTTP. Los servicios lanzan AppError
 * y el middleware global de errores lo convierte en respuesta JSON.
 */
class AppError extends Error {
  constructor(mensaje, statusCode = 500, detalles = undefined) {
    super(mensaje);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.detalles = detalles;
    this.esOperacional = true; // error esperado (no un bug)
  }

  static badRequest(msg = 'Petición inválida', detalles) { return new AppError(msg, 400, detalles); }
  static unauthorized(msg = 'No autenticado') { return new AppError(msg, 401); }
  static forbidden(msg = 'No tienes permiso para realizar esta acción') { return new AppError(msg, 403); }
  static notFound(msg = 'Recurso no encontrado') { return new AppError(msg, 404); }
  static conflict(msg = 'Conflicto con el estado actual del recurso') { return new AppError(msg, 409); }
}

module.exports = AppError;
