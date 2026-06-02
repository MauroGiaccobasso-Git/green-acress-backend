/*
  Warnings:

  - Added the required column `precio_unitario` to the `CompraDetalle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `CompraDetalle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CompraDetalle" ADD COLUMN     "precio_unitario" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL;
