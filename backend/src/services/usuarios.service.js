const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { paginacion, metaPaginacion } = require('../utils/respuesta');
const { SELECT_USUARIO } = require('./auth.service');
const { ROLES } = require('../constants');

const listar = async (restauranteId, { rol, activo, q, ...pag }) => {
  const where = {
    restauranteId,
    ...(rol && { rol }),
    ...(activo !== undefined && { activo }),
    ...(q && {
      OR: [
        { nombre: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }),
  };
  const [total, data] = await prisma.$transaction([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({ where, select: SELECT_USUARIO, orderBy: { nombre: 'asc' }, ...paginacion(pag) }),
  ]);
  return { data, meta: metaPaginacion(total, pag) };
};

/** findFirst con restauranteId → un admin NO puede ver usuarios de otro restaurante (IDOR). */
const obtener = async (restauranteId, id) => {
  const usuario = await prisma.usuario.findFirst({ where: { id, restauranteId }, select: SELECT_USUARIO });
  if (!usuario) throw AppError.notFound('Usuario no encontrado');
  return usuario;
};

const crear = async (restauranteId, datos) => {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email }, select: { id: true } });
  if (existe) throw AppError.conflict('El email ya está registrado');

  return prisma.usuario.create({
    data: { ...datos, password: await bcrypt.hash(datos.password, env.bcryptRounds), restauranteId },
    select: SELECT_USUARIO,
  });
};

/** Evita que el restaurante se quede sin ningún ADMIN activo. */
const asegurarOtroAdmin = async (restauranteId, excluirId) => {
  const admins = await prisma.usuario.count({
    where: { restauranteId, rol: ROLES.ADMIN, activo: true, id: { not: excluirId } },
  });
  if (admins === 0) throw AppError.conflict('Debe existir al menos un ADMIN activo en el restaurante');
};

const actualizar = async (restauranteId, id, datos, solicitanteId) => {
  const actual = await obtener(restauranteId, id);

  const pierdeAdmin =
    actual.rol === ROLES.ADMIN && ((datos.rol && datos.rol !== ROLES.ADMIN) || datos.activo === false);
  if (pierdeAdmin) await asegurarOtroAdmin(restauranteId, id);
  if (id === solicitanteId && datos.activo === false) throw AppError.badRequest('No puedes desactivarte a ti mismo');

  if (datos.email && datos.email !== actual.email) {
    const existe = await prisma.usuario.findUnique({ where: { email: datos.email }, select: { id: true } });
    if (existe) throw AppError.conflict('El email ya está registrado');
  }

  const data = { ...datos };
  if (data.password) data.password = await bcrypt.hash(data.password, env.bcryptRounds);

  return prisma.usuario.update({ where: { id }, data, select: SELECT_USUARIO });
};

/**
 * "Eliminar" = baja lógica (activo=false). Un mesero con comandas históricas
 * no puede borrarse físicamente sin perder la trazabilidad de ventas.
 */
const desactivar = async (restauranteId, id, solicitanteId) => {
  if (id === solicitanteId) throw AppError.badRequest('No puedes desactivarte a ti mismo');
  const actual = await obtener(restauranteId, id);
  if (actual.rol === ROLES.ADMIN) await asegurarOtroAdmin(restauranteId, id);
  return prisma.usuario.update({ where: { id }, data: { activo: false }, select: SELECT_USUARIO });
};

module.exports = { listar, obtener, crear, actualizar, desactivar };
