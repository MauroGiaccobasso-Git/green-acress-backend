-- CreateEnum
CREATE TYPE "TipoDesafioAutenticacion" AS ENUM ('CAMBIO_PASSWORD_TEMPORAL', 'VERIFICACION_MFA', 'CONFIGURACION_MFA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "fecha_configuracion_mfa" TIMESTAMP(3),
ADD COLUMN     "mfa_habilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secreto_cifrado" TEXT,
ADD COLUMN     "password_temporal_expira" TIMESTAMP(3),
ADD COLUMN     "proximo_intento_desde" TIMESTAMP(3),
ADD COLUMN     "requiere_cambio_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimo_intento_fallido" TIMESTAMP(3),
ADD COLUMN     "ventana_intentos_desde" TIMESTAMP(3),
ADD COLUMN     "version_sesion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DesafioAutenticacion" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoDesafioAutenticacion" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "consumido_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesafioAutenticacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecuperacionPassword" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "consumido_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecuperacionPassword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoRecuperacionMfa" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "usado_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoRecuperacionMfa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesafioAutenticacion_token_hash_key" ON "DesafioAutenticacion"("token_hash");

-- CreateIndex
CREATE INDEX "DesafioAutenticacion_usuario_id_tipo_idx" ON "DesafioAutenticacion"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "DesafioAutenticacion_expira_en_idx" ON "DesafioAutenticacion"("expira_en");

-- CreateIndex
CREATE UNIQUE INDEX "RecuperacionPassword_token_hash_key" ON "RecuperacionPassword"("token_hash");

-- CreateIndex
CREATE INDEX "RecuperacionPassword_usuario_id_idx" ON "RecuperacionPassword"("usuario_id");

-- CreateIndex
CREATE INDEX "RecuperacionPassword_expira_en_idx" ON "RecuperacionPassword"("expira_en");

-- CreateIndex
CREATE INDEX "CodigoRecuperacionMfa_usuario_id_usado_en_idx" ON "CodigoRecuperacionMfa"("usuario_id", "usado_en");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoRecuperacionMfa_usuario_id_codigo_hash_key" ON "CodigoRecuperacionMfa"("usuario_id", "codigo_hash");

-- CreateIndex
CREATE INDEX "Auditoria_usuario_id_fecha_creacion_idx" ON "Auditoria"("usuario_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidad_id_idx" ON "Auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "HistorialReserva_reserva_id_fecha_idx" ON "HistorialReserva"("reserva_id", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoStock_producto_id_fecha_creacion_idx" ON "MovimientoStock"("producto_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "MovimientoStock_referencia_tipo_referencia_id_idx" ON "MovimientoStock"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX "Reserva_socio_id_estado_idx" ON "Reserva"("socio_id", "estado");

-- CreateIndex
CREATE INDEX "Reserva_estado_fecha_limite_retiro_idx" ON "Reserva"("estado", "fecha_limite_retiro");

-- CreateIndex
CREATE INDEX "Socio_estado_idx" ON "Socio"("estado");

-- CreateIndex
CREATE INDEX "Socio_nombre_apellido_idx" ON "Socio"("nombre", "apellido");

-- CreateIndex
CREATE INDEX "Usuario_estado_idx" ON "Usuario"("estado");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_proximo_intento_desde_idx" ON "Usuario"("proximo_intento_desde");

-- AddForeignKey
ALTER TABLE "DesafioAutenticacion" ADD CONSTRAINT "DesafioAutenticacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecuperacionPassword" ADD CONSTRAINT "RecuperacionPassword_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoRecuperacionMfa" ADD CONSTRAINT "CodigoRecuperacionMfa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
