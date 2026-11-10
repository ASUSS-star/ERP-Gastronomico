/**
 * SEEDER — Carga los datos REALES de un restaurante desde un archivo JSON.
 *
 *   1) Copia  prisma/datos/restaurante.ejemplo.json  →  prisma/datos/restaurante.json
 *   2) Llena restaurante.json con tu información (ese archivo NO se sube a Git)
 *   3) npm run db:seed
 *
 * Qué hace:
 *  - Elimina los restaurantes de demostración antiguos ("La Huerta", "Tacos El Güero") si aún existen.
 *  - Crea el restaurante con su personal, mesas, proveedores, insumos (con su stock inicial en el kardex),
 *    categorías y platillos con receta.
 *  - NO inventa comandas ni ventas: el historial empieza vacío y se llena al operar.
 *  - Si el restaurante ya existe NO lo toca (para no borrar ventas reales).
 *    Para borrarlo y volver a cargarlo:  npm run db:seed:reiniciar
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
// Reutilizamos el cliente de la app (carga y valida el .env)
const prisma = require('../src/config/prisma');
const env = require('../src/config/env');
const { slugify } = require('../src/utils/slug');

const ARCHIVO = process.env.SEED_DATOS || path.join(__dirname, 'datos', 'restaurante.json');
const REINICIAR = process.argv.includes('--reiniciar');
const SLUGS_DEMO = ['la-huerta-cocina-mexicana', 'tacos-el-guero'];
const ROLES = ['ADMIN', 'MESERO', 'COCINERO', 'CAJERO'];
const PASSWORD_OK = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Lee y valida el archivo. Devuelve los datos o lanza un error con TODOS los problemas encontrados. */
function cargarDatos() {
  if (!fs.existsSync(ARCHIVO)) {
    throw new Error(
      `No existe ${path.relative(process.cwd(), ARCHIVO)}.\n` +
        '   Copia prisma/datos/restaurante.ejemplo.json como prisma/datos/restaurante.json y llénalo con tus datos.',
    );
  }
  const d = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
  const errores = [];
  const falta = (cond, msg) => { if (!cond) errores.push(msg); };
  const texto = (v) => typeof v === 'string' && v.trim().length >= 2;
  const duplicados = (lista) => lista.filter((x, i) => lista.indexOf(x) !== i);

  if (JSON.stringify(d).includes('REEMPLAZA')) errores.push('Aún hay valores de ejemplo ("REEMPLAZA…"): cámbialos por tus datos reales.');

  falta(texto(d.restaurante?.nombre), 'restaurante.nombre es obligatorio');

  const usuarios = d.usuarios ?? [];
  falta(usuarios.some((u) => u.rol === 'ADMIN'), 'Debe haber al menos un usuario con rol ADMIN');
  usuarios.forEach((u, i) => {
    const quien = `usuarios[${i}] (${u.email || 'sin email'})`;
    falta(texto(u.nombre), `${quien}: falta el nombre`);
    falta(/^\S+@\S+\.\S+$/.test(u.email || ''), `${quien}: email inválido`);
    falta(ROLES.includes(u.rol), `${quien}: rol debe ser uno de ${ROLES.join(', ')}`);
    const pass = u.password || process.env.SEED_PASSWORD;
    falta(pass, `${quien}: falta "password" (o define SEED_PASSWORD en el .env como contraseña inicial común)`);
    if (pass) falta(PASSWORD_OK.test(pass), `${quien}: la contraseña debe tener 8+ caracteres con al menos una letra y un número`);
  });
  duplicados(usuarios.map((u) => (u.email || '').toLowerCase())).forEach((e) => errores.push(`Email repetido: ${e}`));

  const mesas = d.mesas ?? [];
  mesas.forEach((m, i) => falta(Number.isInteger(m.numero) && m.numero > 0, `mesas[${i}]: "numero" debe ser un entero positivo`));
  duplicados(mesas.map((m) => m.numero)).forEach((n) => errores.push(`Mesa repetida: ${n}`));

  const proveedores = (d.proveedores ?? []).map((p) => p.nombre);
  (d.proveedores ?? []).forEach((p, i) => falta(texto(p.nombre), `proveedores[${i}]: falta el nombre`));

  const insumos = (d.insumos ?? []).map((x) => x.nombre);
  (d.insumos ?? []).forEach((x, i) => {
    falta(texto(x.nombre), `insumos[${i}]: falta el nombre`);
    falta(typeof x.unidad === 'string' && x.unidad.trim(), `insumos[${i}] (${x.nombre}): falta la unidad (kg, lt, pza…)`);
    ['stock', 'minimo', 'costo'].forEach((k) => falta(x[k] === undefined || (typeof x[k] === 'number' && x[k] >= 0), `insumos[${i}] (${x.nombre}): "${k}" debe ser un número ≥ 0`));
    falta(!x.proveedor || proveedores.includes(x.proveedor), `insumos[${i}] (${x.nombre}): el proveedor "${x.proveedor}" no está en la lista de proveedores`);
  });
  duplicados(insumos).forEach((n) => errores.push(`Insumo repetido: ${n}`));

  const categorias = d.categorias ?? [];
  (d.platillos ?? []).forEach((p, i) => {
    falta(texto(p.nombre), `platillos[${i}]: falta el nombre`);
    falta(typeof p.precio === 'number' && p.precio > 0, `platillos[${i}] (${p.nombre}): "precio" debe ser un número mayor a 0`);
    falta(!p.categoria || categorias.includes(p.categoria), `platillos[${i}] (${p.nombre}): la categoría "${p.categoria}" no está en "categorias"`);
    (p.receta ?? []).forEach((r) => {
      falta(insumos.includes(r.insumo), `platillos[${i}] (${p.nombre}): el insumo "${r.insumo}" de la receta no está en "insumos"`);
      falta(typeof r.cantidad === 'number' && r.cantidad > 0, `platillos[${i}] (${p.nombre}): cantidad inválida para "${r.insumo}"`);
    });
  });
  duplicados((d.platillos ?? []).map((p) => p.nombre)).forEach((n) => errores.push(`Platillo repetido: ${n}`));

  if (errores.length) throw new Error(`Revisa ${path.basename(ARCHIVO)}:\n   - ${errores.join('\n   - ')}`);
  return d;
}

/** Borra restaurantes completos por slug (comandas primero para respetar las llaves foráneas). */
async function borrarRestaurantes(slugs) {
  const encontrados = await prisma.restaurante.findMany({ where: { slug: { in: slugs } }, select: { id: true, nombre: true } });
  if (!encontrados.length) return [];
  const ids = encontrados.map((r) => r.id);
  await prisma.comanda.deleteMany({ where: { restauranteId: { in: ids } } });
  await prisma.restaurante.deleteMany({ where: { id: { in: ids } } }); // cascade al resto
  return encontrados.map((r) => r.nombre);
}

async function main() {
  console.log('🌱 Iniciando carga de datos...');
  const d = cargarDatos();
  const slug = slugify(d.restaurante.nombre);

  const demos = await borrarRestaurantes(SLUGS_DEMO.filter((s) => s !== slug));
  if (demos.length) console.log(`🧹 Datos de demostración eliminados: ${demos.join(', ')}`);

  if (await prisma.restaurante.findUnique({ where: { slug }, select: { id: true } })) {
    if (!REINICIAR) {
      throw new Error(
        `"${d.restaurante.nombre}" ya existe en la base de datos; no se modificó nada.\n` +
          '   Para BORRARLO (incluidas sus ventas) y volver a cargarlo: npm run db:seed:reiniciar',
      );
    }
    await borrarRestaurantes([slug]);
    console.log(`♻️  "${d.restaurante.nombre}" eliminado para volver a cargarlo.`);
  }

  const emails = d.usuarios.map((u) => u.email.trim().toLowerCase());
  const ocupados = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { email: true } });
  if (ocupados.length) throw new Error(`Estos correos ya los usa otro restaurante: ${ocupados.map((o) => o.email).join(', ')}`);

  // ---------------- Restaurante, personal y mesas ----------------
  const usuarios = await Promise.all(
    d.usuarios.map(async (u) => ({
      nombre: u.nombre.trim(),
      email: u.email.trim().toLowerCase(),
      rol: u.rol,
      password: await bcrypt.hash(u.password || process.env.SEED_PASSWORD, env.bcryptRounds),
    })),
  );
  const restaurante = await prisma.restaurante.create({
    data: {
      nombre: d.restaurante.nombre.trim(),
      slug,
      telefono: d.restaurante.telefono || null,
      direccion: d.restaurante.direccion || null,
      usuarios: { create: usuarios },
      mesas: { create: (d.mesas ?? []).map((m) => ({ numero: m.numero, capacidad: m.capacidad ?? 4 })) },
    },
    include: { usuarios: true },
  });
  const rid = restaurante.id;
  const admin = restaurante.usuarios.find((u) => u.rol === 'ADMIN');

  // ---------------- Proveedores ----------------
  const proveedores = {};
  for (const p of d.proveedores ?? []) {
    // eslint-disable-next-line no-await-in-loop
    proveedores[p.nombre] = await prisma.proveedor.create({
      data: { restauranteId: rid, nombre: p.nombre.trim(), contacto: p.contacto || null, telefono: p.telefono || null, email: p.email || null },
    });
  }

  // ---------------- Insumos (el stock inicial queda en el kardex como ENTRADA) ----------------
  const insumos = {};
  for (const x of d.insumos ?? []) {
    const stock = x.stock ?? 0;
    // eslint-disable-next-line no-await-in-loop
    insumos[x.nombre] = await prisma.insumo.create({
      data: {
        restauranteId: rid,
        nombre: x.nombre.trim(),
        unidad: x.unidad.trim(),
        stockActual: stock,
        stockMinimo: x.minimo ?? 0,
        costoUnitario: x.costo ?? 0,
        proveedorId: x.proveedor ? proveedores[x.proveedor].id : null,
        ...(stock > 0 && {
          movimientos: { create: { tipo: 'ENTRADA', cantidad: stock, stockFinal: stock, motivo: 'Stock inicial', usuarioId: admin.id } },
        }),
      },
    });
  }

  // ---------------- Categorías y platillos con receta ----------------
  const categorias = {};
  for (const nombre of d.categorias ?? []) {
    // eslint-disable-next-line no-await-in-loop
    categorias[nombre] = await prisma.categoria.create({ data: { nombre, restauranteId: rid } });
  }
  for (const p of d.platillos ?? []) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.platillo.create({
      data: {
        restauranteId: rid,
        categoriaId: p.categoria ? categorias[p.categoria].id : null,
        nombre: p.nombre.trim(),
        precio: p.precio,
        descripcion: p.descripcion || null,
        disponible: p.disponible ?? true,
        receta: { create: (p.receta ?? []).map((r) => ({ insumoId: insumos[r.insumo].id, cantidad: r.cantidad })) },
      },
    });
  }

  console.log(`✅ "${restaurante.nombre}" cargado: ${usuarios.length} usuarios, ${(d.mesas ?? []).length} mesas, ` +
    `${(d.proveedores ?? []).length} proveedores, ${(d.insumos ?? []).length} insumos, ${(d.platillos ?? []).length} platillos.`);
  console.table(restaurante.usuarios.map((u) => ({ rol: u.rol, nombre: u.nombre, email: u.email })));
  console.log('🔑 Cada usuario entra con la contraseña definida en restaurante.json (o SEED_PASSWORD). Pídeles cambiarla.');
}

main()
  .catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
