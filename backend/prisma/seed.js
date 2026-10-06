/**
 * SEEDER — Pobla la BD con datos iniciales de prueba.
 *   npm run db:seed        (o: npx prisma db seed)
 *
 * Crea 2 restaurantes para demostrar el aislamiento multi-restaurante:
 *   1) "La Huerta Cocina Mexicana" → menú completo, inventario, proveedores, 4 roles y comandas de ejemplo
 *   2) "Tacos El Güero"             → sólo un admin (para probar que NO ve datos del restaurante 1)
 *
 * Es idempotente: si se vuelve a ejecutar, borra y recrea los restaurantes demo.
 * Las comandas se crean con el MISMO servicio que usa la API, así el inventario se descuenta de verdad.
 */
const bcrypt = require('bcryptjs');
// Reutilizamos el cliente de la app (carga y valida el .env)
const prisma = require('../src/config/prisma');
const comandasService = require('../src/services/comandas.service');

const PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
const SLUGS_DEMO = ['la-huerta-cocina-mexicana', 'tacos-el-guero'];

async function limpiar() {
  const demos = await prisma.restaurante.findMany({ where: { slug: { in: SLUGS_DEMO } }, select: { id: true } });
  const ids = demos.map((r) => r.id);
  if (!ids.length) return;
  // Orden explícito para respetar llaves foráneas
  await prisma.comanda.deleteMany({ where: { restauranteId: { in: ids } } });
  await prisma.restaurante.deleteMany({ where: { id: { in: ids } } }); // cascade al resto
}

async function main() {
  console.log('🌱 Iniciando seed...');
  await limpiar();

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ---------------- Restaurante 1 ----------------
  const r1 = await prisma.restaurante.create({
    data: {
      nombre: 'La Huerta Cocina Mexicana',
      slug: SLUGS_DEMO[0],
      telefono: '3571234567',
      direccion: 'Av. Principal 100, La Huerta, Jalisco',
      usuarios: {
        create: [
          { nombre: 'Ana Administradora', email: 'admin@lahuerta.com', password: hash, rol: 'ADMIN' },
          { nombre: 'Mario Mesero', email: 'mesero@lahuerta.com', password: hash, rol: 'MESERO' },
          { nombre: 'Lucía Mesera', email: 'mesero2@lahuerta.com', password: hash, rol: 'MESERO' },
          { nombre: 'Carlos Cocinero', email: 'cocinero@lahuerta.com', password: hash, rol: 'COCINERO' },
          { nombre: 'Carmen Cajera', email: 'cajero@lahuerta.com', password: hash, rol: 'CAJERO' },
        ],
      },
      mesas: {
        create: Array.from({ length: 8 }, (_, i) => ({ numero: i + 1, capacidad: i < 6 ? 4 : 8 })),
      },
    },
    include: { usuarios: true, mesas: true },
  });
  const rid = r1.id;
  const usuario = (email) => r1.usuarios.find((u) => u.email === email);

  // Proveedores
  const [carniceria, verduras, abarrotes, bebidas] = await Promise.all(
    [
      { nombre: 'Carnicería El Toro', contacto: 'Don Ramiro', telefono: '3571110001', email: 'ventas@eltoro.mx' },
      { nombre: 'Verduras Frescas del Valle', contacto: 'Sra. Elena', telefono: '3571110002' },
      { nombre: 'Abarrotes La Central', contacto: 'Jorge', telefono: '3571110003' },
      { nombre: 'Distribuidora de Bebidas Costa', contacto: 'Iván', telefono: '3571110004' },
    ].map((p) => prisma.proveedor.create({ data: { ...p, restauranteId: rid } })),
  );

  // Insumos (stock inicial registrado como movimiento ENTRADA)
  const insumosData = [
    ['Carne de res', 'kg', 25, 5, 180, carniceria.id],
    ['Pechuga de pollo', 'kg', 20, 5, 120, carniceria.id],
    ['Carne al pastor', 'kg', 15, 4, 140, carniceria.id],
    ['Tortilla de maíz', 'pza', 600, 100, 0.8, abarrotes.id],
    ['Queso Oaxaca', 'kg', 8, 2, 150, abarrotes.id],
    ['Cebolla', 'kg', 10, 2, 25, verduras.id],
    ['Cilantro', 'kg', 2, 0.5, 40, verduras.id],
    ['Aguacate', 'kg', 6, 2, 70, verduras.id],
    ['Jitomate', 'kg', 12, 3, 30, verduras.id],
    ['Arroz', 'kg', 15, 3, 28, abarrotes.id],
    ['Frijol', 'kg', 15, 3, 35, abarrotes.id],
    ['Refresco 600ml', 'pza', 48, 12, 14, bebidas.id],
    ['Agua natural 1L', 'pza', 3, 10, 9, bebidas.id], // ← ya en stock bajo (para probar alertas)
  ];
  const admin = usuario('admin@lahuerta.com');
  const insumos = {};
  for (const [nombre, unidad, stock, minimo, costo, proveedorId] of insumosData) {
    // eslint-disable-next-line no-await-in-loop
    insumos[nombre] = await prisma.insumo.create({
      data: {
        restauranteId: rid,
        nombre,
        unidad,
        stockActual: stock,
        stockMinimo: minimo,
        costoUnitario: costo,
        proveedorId,
        movimientos: {
          create: { tipo: 'ENTRADA', cantidad: stock, stockFinal: stock, motivo: 'Stock inicial (seed)', usuarioId: admin.id },
        },
      },
    });
  }

  // Categorías
  const categorias = {};
  for (const nombre of ['Entradas', 'Tacos', 'Platos fuertes', 'Bebidas', 'Postres']) {
    // eslint-disable-next-line no-await-in-loop
    categorias[nombre] = await prisma.categoria.create({ data: { nombre, restauranteId: rid } });
  }

  // Platillos + recetas  [nombre, categoría, precio, descripción, [[insumo, cantidad], ...]]
  const menu = [
    ['Guacamole con totopos', 'Entradas', 95, 'Aguacate, jitomate, cebolla y cilantro', [['Aguacate', 0.25], ['Jitomate', 0.05], ['Cebolla', 0.03], ['Cilantro', 0.01], ['Tortilla de maíz', 4]]],
    ['Quesadillas (3)', 'Entradas', 85, 'Tortilla de maíz con queso Oaxaca', [['Tortilla de maíz', 3], ['Queso Oaxaca', 0.12]]],
    ['Orden de tacos al pastor (5)', 'Tacos', 110, 'Con piña, cebolla y cilantro', [['Carne al pastor', 0.25], ['Tortilla de maíz', 5], ['Cebolla', 0.03], ['Cilantro', 0.01]]],
    ['Orden de tacos de asada (5)', 'Tacos', 125, 'Carne de res asada', [['Carne de res', 0.25], ['Tortilla de maíz', 5], ['Cebolla', 0.03], ['Cilantro', 0.01]]],
    ['Carne asada a la tampiqueña', 'Platos fuertes', 210, 'Con arroz, frijoles y guacamole', [['Carne de res', 0.3], ['Arroz', 0.1], ['Frijol', 0.1], ['Aguacate', 0.1], ['Tortilla de maíz', 4]]],
    ['Pechuga a la plancha', 'Platos fuertes', 175, 'Con arroz y ensalada', [['Pechuga de pollo', 0.25], ['Arroz', 0.1], ['Jitomate', 0.05]]],
    ['Refresco', 'Bebidas', 35, 'Refresco de 600ml', [['Refresco 600ml', 1]]],
    ['Agua natural', 'Bebidas', 25, 'Botella de 1L', [['Agua natural 1L', 1]]],
    ['Agua fresca de horchata', 'Bebidas', 40, 'Vaso de 1L (preparada en casa)', []],
    ['Flan napolitano', 'Postres', 55, 'Postre de la casa', []],
  ];
  const platillos = {};
  for (const [nombre, cat, precio, descripcion, receta] of menu) {
    // eslint-disable-next-line no-await-in-loop
    platillos[nombre] = await prisma.platillo.create({
      data: {
        restauranteId: rid,
        categoriaId: categorias[cat].id,
        nombre,
        precio,
        descripcion,
        receta: { create: receta.map(([insumo, cantidad]) => ({ insumoId: insumos[insumo].id, cantidad })) },
      },
    });
  }

  // Comandas de ejemplo usando la lógica real del servicio (descuenta inventario)
  const mesero = { ...usuario('mesero@lahuerta.com'), restauranteId: rid };
  const mesero2 = { ...usuario('mesero2@lahuerta.com'), restauranteId: rid };
  const cocinero = { ...usuario('cocinero@lahuerta.com'), restauranteId: rid };
  const cajero = { ...usuario('cajero@lahuerta.com'), restauranteId: rid };
  const mesa = (n) => r1.mesas.find((m) => m.numero === n).id;
  const p = (nombre) => platillos[nombre].id;

  // 1) Comanda PAGADA (mesa 1)
  const c1 = await comandasService.crear(mesero, {
    mesaId: mesa(1),
    items: [
      { platilloId: p('Orden de tacos al pastor (5)'), cantidad: 2 },
      { platilloId: p('Refresco'), cantidad: 2 },
    ],
  });
  await comandasService.cambiarEstado(cocinero, c1.id, { estado: 'EN_PREPARACION' });
  await comandasService.cambiarEstado(mesero, c1.id, { estado: 'ENTREGADO' });
  await comandasService.cambiarEstado(cajero, c1.id, { estado: 'PAGADO', metodoPago: 'EFECTIVO' });

  // 2) Comanda EN_PREPARACION (mesa 2)
  const c2 = await comandasService.crear(mesero, {
    mesaId: mesa(2),
    notas: 'Cliente con prisa',
    items: [
      { platilloId: p('Carne asada a la tampiqueña'), cantidad: 1, notas: 'Término medio' },
      { platilloId: p('Guacamole con totopos'), cantidad: 1 },
    ],
  });
  await comandasService.cambiarEstado(cocinero, c2.id, { estado: 'EN_PREPARACION' });

  // 3) Comanda PENDIENTE (mesa 3, otra mesera)
  await comandasService.crear(mesero2, {
    mesaId: mesa(3),
    items: [
      { platilloId: p('Quesadillas (3)'), cantidad: 1, notas: 'Sin salsa' },
      { platilloId: p('Agua fresca de horchata'), cantidad: 2 },
    ],
  });

  // ---------------- Restaurante 2 (aislamiento) ----------------
  await prisma.restaurante.create({
    data: {
      nombre: 'Tacos El Güero',
      slug: SLUGS_DEMO[1],
      usuarios: { create: { nombre: 'Güero Admin', email: 'admin@elguero.com', password: hash, rol: 'ADMIN' } },
      mesas: { create: [{ numero: 1 }, { numero: 2 }] },
      categorias: { create: [{ nombre: 'Tacos' }] },
    },
  });

  console.log('✅ Seed completado.');
  console.table([
    { restaurante: 'La Huerta', rol: 'ADMIN', email: 'admin@lahuerta.com' },
    { restaurante: 'La Huerta', rol: 'MESERO', email: 'mesero@lahuerta.com' },
    { restaurante: 'La Huerta', rol: 'MESERO', email: 'mesero2@lahuerta.com' },
    { restaurante: 'La Huerta', rol: 'COCINERO', email: 'cocinero@lahuerta.com' },
    { restaurante: 'La Huerta', rol: 'CAJERO', email: 'cajero@lahuerta.com' },
    { restaurante: 'El Güero', rol: 'ADMIN', email: 'admin@elguero.com' },
  ]);
  console.log(`🔑 Contraseña de todos los usuarios: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
