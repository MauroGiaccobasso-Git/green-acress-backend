import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   VALIDACIONES INTERNAS
========================================================= */

const validarEntrega = (entrega) => {
  if (!entrega) {
    throw new AppError(
      "La entrega de notificación no existe",
      404,
    );
  }
};


/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

const validarIdEntrega = (id) => {
  const entregaId = Number(id);

  if (!Number.isInteger(entregaId) || entregaId <= 0) {
    throw new AppError(
      "El id de la entrega es inválido",
      400,
    );
  }

  return entregaId;
};


/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerEntregaPorId = async (
  entregaId,
  tx = prisma,
) => {
  const entrega =
    await tx.notificacionEntrega.findUnique({
      where: {
        id: entregaId,
      },
    });

  validarEntrega(entrega);

  return entrega;
};


/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */


/**
 * Crea una entrega pendiente asociada a una notificación.
 *
 * La entrega representa el procesamiento de comunicación
 * por un canal determinado.
 *
 * Actualmente queda preparada para futuras integraciones
 * con providers externos.
 */
export const crearEntrega = async (
  {
    notificacionId,
    canal,
  },
  tx = prisma,
) => {
  if (!notificacionId || !canal) {
    throw new AppError(
      "Los datos de la entrega son obligatorios",
      400,
    );
  }

  return tx.notificacionEntrega.create({
    data: {
      notificacion_id: notificacionId,
      canal,
    },
  });
};


/**
 * Actualiza el estado de una entrega.
 *
 * Estados soportados:
 *
 * PENDIENTE
 * ENVIADA
 * ERROR
 */
export const actualizarEstadoEntrega = async (
  {
    entregaId,
    estado,
    errorDetalle = null,
  },
  tx = prisma,
) => {
  const idEntrega = validarIdEntrega(entregaId);

  await obtenerEntregaPorId(
    idEntrega,
    tx,
  );

  return tx.notificacionEntrega.update({
    where: {
      id: idEntrega,
    },
    data: {
      estado,
      error_detalle: errorDetalle,
      fecha_envio:
        estado === "ENVIADA"
          ? new Date()
          : undefined,
    },
  });
};


/**
 * Registra un nuevo intento de entrega.
 *
 * Será utilizado posteriormente por el proceso
 * encargado de ejecutar los envíos.
 */
export const registrarIntentoEntrega = async (
  {
    entregaId,
    errorDetalle = null,
  },
  tx = prisma,
) => {
  const idEntrega = validarIdEntrega(entregaId);

  await obtenerEntregaPorId(
    idEntrega,
    tx,
  );

  return tx.notificacionEntrega.update({
    where: {
      id: idEntrega,
    },
    data: {
      intentos: {
        increment: 1,
      },
      fecha_ultimo_intento: new Date(),
      error_detalle: errorDetalle,
    },
  });
};