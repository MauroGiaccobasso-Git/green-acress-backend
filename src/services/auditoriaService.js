import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const EMAIL_USUARIO_SISTEMA =
  process.env.SYSTEM_USER_EMAIL || "system@greenacres.local";

/* =========================================================
   HELPERS
========================================================= */

export const obtenerUsuarioSistema = async (tx = prisma) => {
  const usuarioSistema = await tx.usuario.findUnique({
    where: {
      email: EMAIL_USUARIO_SISTEMA,
    },
    select: {
      id: true,
    },
  });

  if (!usuarioSistema) {
    throw new AppError(
      "El usuario técnico del sistema no se encuentra configurado",
      500,
    );
  }

  return usuarioSistema;
};

/* =========================================================
   OPERACIONES DEL MÓDULO
========================================================= */

/**
 * Registra una acción relevante realizada por un usuario real del sistema.
 */
export const registrarAuditoria = async (
  { usuarioId, accion, entidad, entidadId = null, detalle = null },
  tx = prisma,
) => {
  if (!usuarioId) {
    throw new AppError(
      "El usuario responsable de la auditoría es obligatorio",
      500,
    );
  }

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

/**
 * Registra una acción ejecutada automáticamente por el sistema.
 */
export const registrarAuditoriaSistema = async (
  { accion, entidad, entidadId = null, detalle = null },
  tx = prisma,
) => {
  const usuarioSistema = await obtenerUsuarioSistema(tx);

  return registrarAuditoria(
    {
      usuarioId: usuarioSistema.id,
      accion,
      entidad,
      entidadId,
      detalle,
    },
    tx,
  );
};