/*
  Warnings:

  - The values [PENDIENTE,RECIBIDA,CANCELADA] on the enum `EstadoCompra` will be removed. If these variants are still used in the database, this will fail.
  - The values [COMPLETADA] on the enum `EstadoVenta` will be removed. If these variants are still used in the database, this will fail.
  - The values [LIBERACION] on the enum `TipoMovimientoStock` will be removed. If these variants are still used in the database, this will fail.
  - The `estado` column on the `Socio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estado` column on the `Usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `tipo` on the `Producto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `unidad_medida` on the `Producto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoSocio" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('FLOR', 'SEMILLA');

-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('GRAMOS', 'UNIDADES');

-- CreateEnum
CREATE TYPE "GeneticaProducto" AS ENUM ('INDICA', 'SATIVA', 'HIBRIDA');

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCompra_new" AS ENUM ('REGISTRADA', 'ANULADA');
ALTER TABLE "Compra" ALTER COLUMN "estado" TYPE "EstadoCompra_new" USING ("estado"::text::"EstadoCompra_new");
ALTER TYPE "EstadoCompra" RENAME TO "EstadoCompra_old";
ALTER TYPE "EstadoCompra_new" RENAME TO "EstadoCompra";
DROP TYPE "public"."EstadoCompra_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoVenta_new" AS ENUM ('REGISTRADA', 'ANULADA');
ALTER TABLE "Venta" ALTER COLUMN "estado" TYPE "EstadoVenta_new" USING ("estado"::text::"EstadoVenta_new");
ALTER TYPE "EstadoVenta" RENAME TO "EstadoVenta_old";
ALTER TYPE "EstadoVenta_new" RENAME TO "EstadoVenta";
DROP TYPE "public"."EstadoVenta_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TipoMovimientoStock_new" AS ENUM ('INGRESO', 'EGRESO', 'RESERVA', 'LIBERACION_RESERVA', 'AJUSTE');
ALTER TABLE "MovimientoStock" ALTER COLUMN "tipo" TYPE "TipoMovimientoStock_new" USING ("tipo"::text::"TipoMovimientoStock_new");
ALTER TYPE "TipoMovimientoStock" RENAME TO "TipoMovimientoStock_old";
ALTER TYPE "TipoMovimientoStock_new" RENAME TO "TipoMovimientoStock";
DROP TYPE "public"."TipoMovimientoStock_old";
COMMIT;

-- AlterTable
ALTER TABLE "Compra" ALTER COLUMN "estado" SET DEFAULT 'REGISTRADA';

-- AlterTable
ALTER TABLE "Notificacion" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "genetica" "GeneticaProducto",
ADD COLUMN     "porcentaje_thc" DOUBLE PRECISION,
ALTER COLUMN "descripcion" DROP NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoProducto" NOT NULL,
DROP COLUMN "unidad_medida",
ADD COLUMN     "unidad_medida" "UnidadMedida" NOT NULL,
ALTER COLUMN "estado" SET DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Proveedor" ALTER COLUMN "estado" SET DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Reserva" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "Socio" DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoSocio" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Stock" ALTER COLUMN "cantidad_total" SET DEFAULT 0,
ALTER COLUMN "cantidad_disponible" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Venta" ALTER COLUMN "estado" SET DEFAULT 'REGISTRADA';
