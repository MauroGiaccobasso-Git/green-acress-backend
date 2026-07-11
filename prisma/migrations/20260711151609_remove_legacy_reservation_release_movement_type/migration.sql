/*
  Warnings:

  - The values [LIBERACION_RESERVA] on the enum `TipoMovimientoStock` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoMovimientoStock_new" AS ENUM ('INGRESO', 'EGRESO', 'RESERVA', 'RESERVA_CANCELADA', 'RESERVA_VENCIDA', 'AJUSTE');
ALTER TABLE "MovimientoStock" ALTER COLUMN "tipo" TYPE "TipoMovimientoStock_new" USING ("tipo"::text::"TipoMovimientoStock_new");
ALTER TYPE "TipoMovimientoStock" RENAME TO "TipoMovimientoStock_old";
ALTER TYPE "TipoMovimientoStock_new" RENAME TO "TipoMovimientoStock";
DROP TYPE "public"."TipoMovimientoStock_old";
COMMIT;
