const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { firmarToken } = require('../utils/jwt');
const { slugify } = require('../utils/slug');
const { ROLES } = require('../constants');

// Campos públicos del usuario (NUNCA devolver el hash del password)
const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  restauranteId: true,
  createdAt: true,
};

// Hash "dummy" para comparar cuando el email no existe y así igualar
// el tiempo de respuesta (evita enumerar correos por timing).
const HASH_DUMMY = bcrypt.hashSync('dummy-password-para-timing', 10);

/** Genera un slug único: "tacos-don-pepe", "tacos-don-pepe-3f9a"... */
const generarSlugUnico = async (nombre) => {
  const base = slugify(nombre) || 'restaurante';
  let slug = base;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.restaurante.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return slug;
};

/**
 * Onboarding SaaS: un restaurante nuevo se registra y queda con su usuario ADMIN.
 * Restaurante + admin se crean en la misma operación (si una falla, no queda basura).
 */
const registrarRestaurante = async ({ restaurante, admin }) => {
  const existe = await prisma.usuario.findUnique({ where: { email: admin.email }, select: { id: true } });
  if (existe) throw AppError.conflict('El email ya está registrado');

  const slug = await generarSlugUnico(restaurante.nombre);
  const hash = await bcrypt.hash(admin.password, env.bcryptRounds);

  const nuevo = await prisma.restaurante.create({
    data: {
      nombre: restaurante.nombre,
      telefono: restaurante.telefono || null,
      direccion: restaurante.direccion || null,
      slug,
      usuarios: {
        create: { nombre: admin.nombre, email: admin.email, password: hash, rol: ROLES.ADMIN },
      },
    },
    include: { usuarios: { select: SELECT_USUARIO } },
  });

  const usuario = nuevo.usuarios[0];
  const { usuarios, ...datosRestaurante } = nuevo;
  return { token: firmarToken(usuario), usuario, restaurante: datosRestaurante };
};

const login = async ({ email, password }) => {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { restaurante: { select: { id: true, nombre: true, slug: true, activo: true } } },
  });

  const passwordOk = await bcrypt.compare(password, usuario ? usuario.password : HASH_DUMMY);
  // Mismo mensaje para "no existe" y "contraseña incorrecta" → no revelamos qué emails existen
  if (!usuario || !passwordOk) throw AppError.unauthorized('Credenciales inválidas');
  if (!usuario.activo) throw AppError.forbidden('Tu usuario está desactivado. Contacta al administrador');
  if (!usuario.restaurante.activo) throw AppError.forbidden('El restaurante está suspendido');

  const { password: _omit, restaurante, ...datos } = usuario;
  return { token: firmarToken(usuario), usuario: datos, restaurante };
};

const perfil = async (userId) =>
  prisma.usuario.findUnique({
    where: { id: userId },
    select: { ...SELECT_USUARIO, restaurante: { select: { id: true, nombre: true, slug: true, telefono: true, direccion: true } } },
  });

const cambiarPassword = async (userId, { passwordActual, passwordNueva }) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!(await bcrypt.compare(passwordActual, usuario.password))) {
    throw AppError.badRequest('La contraseña actual es incorrecta');
  }
  await prisma.usuario.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(passwordNueva, env.bcryptRounds) },
  });
};

module.exports = { registrarRestaurante, login, perfil, cambiarPassword, SELECT_USUARIO };
