-- Estado LISTO: la cocina terminó y el mesero recibe el aviso
ALTER TYPE "EstadoComanda" ADD VALUE IF NOT EXISTS 'LISTO' BEFORE 'ENTREGADO';

-- Idempotencia para el modo sin internet
ALTER TABLE "comandas" ADD COLUMN "clienteId" VARCHAR(64);
CREATE UNIQUE INDEX "comandas_clienteId_key" ON "comandas"("clienteId");

-- Pagos: cuentas divididas y varios métodos de pago por comanda
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "restauranteId" INTEGER NOT NULL,
    "comandaId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "recibido" DECIMAL(10,2),
    "cambio" DECIMAL(10,2),
    "clienteId" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pagos_clienteId_key" ON "pagos"("clienteId");
CREATE INDEX "pagos_restauranteId_createdAt_idx" ON "pagos"("restauranteId", "createdAt");
CREATE INDEX "pagos_comandaId_idx" ON "pagos"("comandaId");

ALTER TABLE "pagos" ADD CONSTRAINT "pagos_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las comandas que ya estaban pagadas conservan su pago en la nueva tabla
INSERT INTO "pagos" ("restauranteId", "comandaId", "metodo", "monto", "createdAt")
SELECT "restauranteId", "id", "metodoPago", "total", COALESCE("pagadoAt", "updatedAt")
FROM "comandas"
WHERE "estado" = 'PAGADO' AND "metodoPago" IS NOT NULL;
