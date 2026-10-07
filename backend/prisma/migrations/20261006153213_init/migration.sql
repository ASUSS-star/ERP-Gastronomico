-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MESERO', 'COCINERO', 'CAJERO');

-- CreateEnum
CREATE TYPE "EstadoComanda" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'ENTREGADO', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('LIBRE', 'OCUPADA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "restaurantes" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoFolio" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MESERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'LIBRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platillos" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "categoriaId" INTEGER,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(500),
    "precio" DECIMAL(10,2) NOT NULL,
    "imagenUrl" VARCHAR(500),
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platillos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas_insumos" (
    "platilloId" INTEGER NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "recetas_insumos_pkey" PRIMARY KEY ("platilloId","insumoId")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "contacto" VARCHAR(100),
    "telefono" VARCHAR(20),
    "email" VARCHAR(150),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "proveedorId" INTEGER,
    "nombre" VARCHAR(120) NOT NULL,
    "unidad" VARCHAR(20) NOT NULL,
    "stockActual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" SERIAL NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "comandaId" INTEGER,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "stockFinal" DECIMAL(12,3) NOT NULL,
    "motivo" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandas" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "folio" INTEGER NOT NULL,
    "mesaId" INTEGER NOT NULL,
    "meseroId" INTEGER NOT NULL,
    "estado" "EstadoComanda" NOT NULL DEFAULT 'PENDIENTE',
    "notas" VARCHAR(500),
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metodoPago" "MetodoPago",
    "pagadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comandas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_comanda" (
    "id" SERIAL NOT NULL,
    "comandaId" INTEGER NOT NULL,
    "platilloId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notas" VARCHAR(255),

    CONSTRAINT "detalles_comanda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurantes_slug_key" ON "restaurantes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_restauranteId_rol_idx" ON "usuarios"("restauranteId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_restauranteId_numero_key" ON "mesas"("restauranteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_restauranteId_nombre_key" ON "categorias"("restauranteId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "platillos_restauranteId_nombre_key" ON "platillos"("restauranteId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_restauranteId_nombre_key" ON "proveedores"("restauranteId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_restauranteId_nombre_key" ON "insumos"("restauranteId", "nombre");

-- CreateIndex
CREATE INDEX "movimientos_inventario_insumoId_createdAt_idx" ON "movimientos_inventario"("insumoId", "createdAt");

-- CreateIndex
CREATE INDEX "comandas_restauranteId_estado_idx" ON "comandas"("restauranteId", "estado");

-- CreateIndex
CREATE INDEX "comandas_mesaId_idx" ON "comandas"("mesaId");

-- CreateIndex
CREATE INDEX "comandas_meseroId_idx" ON "comandas"("meseroId");

-- CreateIndex
CREATE UNIQUE INDEX "comandas_restauranteId_folio_key" ON "comandas"("restauranteId", "folio");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platillos" ADD CONSTRAINT "platillos_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platillos" ADD CONSTRAINT "platillos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_insumos" ADD CONSTRAINT "recetas_insumos_platilloId_fkey" FOREIGN KEY ("platilloId") REFERENCES "platillos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_insumos" ADD CONSTRAINT "recetas_insumos_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_meseroId_fkey" FOREIGN KEY ("meseroId") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comanda" ADD CONSTRAINT "detalles_comanda_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_comanda" ADD CONSTRAINT "detalles_comanda_platilloId_fkey" FOREIGN KEY ("platilloId") REFERENCES "platillos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
