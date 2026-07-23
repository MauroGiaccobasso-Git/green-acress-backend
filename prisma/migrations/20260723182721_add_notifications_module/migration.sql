/*
  Warnings:

  - You are about to drop the column `canal` on the `Notificacion` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_envio` on the `Notificacion` table. All the data in the column will be lost.
  - Made the column `socio_id` on table `Notificacion` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `tipo` on the `Notificacion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EstadoNovedad" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('PASSWORD_TEMPORAL_GENERADA', 'PASSWORD_ACTUALIZADA', 'RECUPERACION_PASSWORD', 'MFA_ACTIVADO', 'RESERVA_CONFIRMADA', 'RESERVA_RECHAZADA', 'RESERVA_CANCELADA', 'RESERVA_VENCIDA', 'VENTA_ANULADA', 'NOVEDAD_PUBLICADA');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('EMAIL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "EstadoEntregaNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'ERROR');

-- DropForeignKey
ALTER TABLE "Notificacion" DROP CONSTRAINT "Notificacion_socio_id_fkey";

-- AlterTable
ALTER TABLE "Notificacion" DROP COLUMN "canal",
DROP COLUMN "fecha_envio",
ADD COLUMN     "novedad_id" INTEGER,
ALTER COLUMN "socio_id" SET NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoNotificacion" NOT NULL;

-- CreateTable
CREATE TABLE "Novedad" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "estado" "EstadoNovedad" NOT NULL DEFAULT 'ACTIVA',
    "usuario_id" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionEntrega" (
    "id" SERIAL NOT NULL,
    "notificacion_id" INTEGER NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "estado" "EstadoEntregaNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "fecha_ultimo_intento" TIMESTAMP(3),
    "fecha_envio" TIMESTAMP(3),
    "error_detalle" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Novedad_estado_idx" ON "Novedad"("estado");

-- CreateIndex
CREATE INDEX "Novedad_usuario_id_idx" ON "Novedad"("usuario_id");

-- CreateIndex
CREATE INDEX "NotificacionEntrega_notificacion_id_idx" ON "NotificacionEntrega"("notificacion_id");

-- CreateIndex
CREATE INDEX "NotificacionEntrega_estado_idx" ON "NotificacionEntrega"("estado");

-- CreateIndex
CREATE INDEX "Notificacion_socio_id_estado_idx" ON "Notificacion"("socio_id", "estado");

-- CreateIndex
CREATE INDEX "Notificacion_novedad_id_idx" ON "Notificacion"("novedad_id");

-- CreateIndex
CREATE INDEX "Notificacion_origen_tipo_origen_id_idx" ON "Notificacion"("origen_tipo", "origen_id");

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "Novedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionEntrega" ADD CONSTRAINT "NotificacionEntrega_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "Notificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
