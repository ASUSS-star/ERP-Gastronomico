/**
 * Controladores: sólo traducen HTTP ⇄ servicio. La lógica de negocio vive en /services.
 * En Express 5 no se necesita try/catch: los errores async llegan solos al errorHandler.
 */
const authService = require('../services/auth.service');
const { ok, creado } = require('../utils/respuesta');

const registro = async (req, res) =>
  creado(res, await authService.registrarRestaurante(req.body), 'Restaurante registrado correctamente');

const login = async (req, res) => ok(res, await authService.login(req.body), 'Inicio de sesión exitoso');

const perfil = async (req, res) => ok(res, await authService.perfil(req.user.id));

const cambiarPassword = async (req, res) => {
  await authService.cambiarPassword(req.user.id, req.body);
  ok(res, null, 'Contraseña actualizada');
};

module.exports = { registro, login, perfil, cambiarPassword };
