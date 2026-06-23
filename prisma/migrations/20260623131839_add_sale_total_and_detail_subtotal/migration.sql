/*
  Warnings:

  - Added the required column `total` to the `Venta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `VentaDetalle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "total" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "VentaDetalle" ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL;
