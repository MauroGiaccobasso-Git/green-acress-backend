import prisma from "../config/prisma.js";

/**
 * Registra una acción relevante realizada dentro del sistema.
 *
 * Este servicio centraliza la creación de registros de auditoría para evitar
 * duplicar lógica en los distintos módulos del backend.
 *
 * Puede recibir una transacción externa para asegurar que la auditoría se guarde
 * dentro de la misma operación principal. Esto es importante en procesos críticos
 * como compras, ventas o reservas.
 */
export const registrarAuditoria = async (
  {
    usuarioId,
    accion,
    entidad,
    entidadId = null,
    detalle = null,
  },
  tx = prisma,
) => {
  return tx.auditoria.create({
    data: {
      usuario_id: usuarioId,
      accion,
      entidad,
      entidad_id: entidadId,
      detalle,
    },
  });
};