-- CreateEnum restantes
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE "EstadoProveedor" AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA', 'VENCIDA', 'FINALIZADA');
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA');
CREATE TYPE "EstadoCompra" AS ENUM ('PENDIENTE', 'RECIBIDA', 'CANCELADA');
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'ERROR');
CREATE TYPE "TipoMovimientoStock" AS ENUM ('INGRESO', 'EGRESO', 'RESERVA', 'LIBERACION', 'AJUSTE');

-- Convertir columnas existentes usando casteo seguro
ALTER TABLE "Producto"
ALTER COLUMN "estado" TYPE "EstadoProducto"
USING "estado"::"EstadoProducto";

ALTER TABLE "Proveedor"
ALTER COLUMN "estado" TYPE "EstadoProveedor"
USING "estado"::"EstadoProveedor";

ALTER TABLE "Compra"
ALTER COLUMN "estado" TYPE "EstadoCompra"
USING "estado"::"EstadoCompra";

ALTER TABLE "Venta"
ALTER COLUMN "estado" TYPE "EstadoVenta"
USING "estado"::"EstadoVenta";

ALTER TABLE "Reserva"
ALTER COLUMN "estado" TYPE "EstadoReserva"
USING "estado"::"EstadoReserva";

ALTER TABLE "HistorialReserva"
ALTER COLUMN "estado" TYPE "EstadoReserva"
USING "estado"::"EstadoReserva";

ALTER TABLE "Notificacion"
ALTER COLUMN "estado" TYPE "EstadoNotificacion"
USING "estado"::"EstadoNotificacion";

ALTER TABLE "MovimientoStock"
ALTER COLUMN "tipo" TYPE "TipoMovimientoStock"
USING "tipo"::"TipoMovimientoStock";