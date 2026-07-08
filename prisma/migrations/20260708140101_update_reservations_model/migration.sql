/*
  Warnings:

  - A unique constraint covering the columns `[venta_id]` on the table `Reserva` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `total` to the `Reserva` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precio_unitario` to the `ReservaDetalle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `ReservaDetalle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "HistorialReserva" ADD COLUMN     "usuario_id" INTEGER;

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "total" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "venta_id" INTEGER,
ALTER COLUMN "fecha_limite_retiro" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReservaDetalle" ADD COLUMN     "precio_unitario" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_venta_id_key" ON "Reserva"("venta_id");

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialReserva" ADD CONSTRAINT "HistorialReserva_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
