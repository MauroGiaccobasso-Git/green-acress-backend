import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const CANALES_ENTREGA_VALIDOS = ["EMAIL", "TELEGRAM"];

const ESTADOS_ENTREGA_VALIDOS = [
  "PENDIENTE",
  "ENVIADA",
  "ERROR",
];

const LONGITUD_MAXIMA_ERROR = 1000;

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

const validarIdPositivo = (valor, nombreCampo) => {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      `El ${nombreCampo} es inválido`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return id;
};

const validarIdEntrega = (id) =>
  validarIdPositivo(id, "id de la entrega");

const validarIdNotificacion = (id) =>
  validarIdPositivo(id, "id de la notificación");

const validarCanalEntrega = (canal) => {
  const canalNormalizado =
    typeof canal === "string"
      ? canal.trim().toUpperCase()
      : "";

  if (!CANALES_ENTREGA_VALIDOS.includes(canalNormalizado)) {
    throw new AppError(
      "El canal de entrega indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return canalNormalizado;
};

const validarEstadoEntrega = (estado) => {
  const estadoNormalizado =
    typeof estado === "string"
      ? estado.trim().toUpperCase()
      : "";

  if (!ESTADOS_ENTREGA_VALIDOS.includes(estadoNormalizado)) {
    throw new AppError(
      "El estado de la entrega indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return estadoNormalizado;
};

const normalizarDetalleError = (errorDetalle) => {
  if (errorDetalle === null || errorDetalle === undefined) {
    return null;
  }

  const detalle = String(errorDetalle).trim();

  return detalle
    ? detalle.slice(0, LONGITUD_MAXIMA_ERROR)
    : null;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerEntregaPorId = async (
  entregaId,
  tx = prisma,
) => {
  const entrega = await tx.notificacionEntrega.findUnique({
    where: {
      id: entregaId,
    },
  });

  if (!entrega) {
    throw new AppError(
      "La entrega de notificación no existe",
      404,
      "NOT_FOUND",
    );
  }

  return entrega;
};

/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */

/**
 * Crea una entrega pendiente para una notificación.
 *
 * La creación puede participar en la transacción del caso
 * de uso que origina la notificación.
 */
export const crearEntrega = async (
  {
    notificacionId,
    canal,
  },
  tx = prisma,
) => {
  const idNotificacion = validarIdNotificacion(notificacionId);
  const canalValidado = validarCanalEntrega(canal);

  return tx.notificacionEntrega.create({
    data: {
      notificacion_id: idNotificacion,
      canal: canalValidado,
      estado: "PENDIENTE",
    },
  });
};

/**
 * Registra el inicio de un intento de entrega.
 *
 * El contador y la fecha se actualizan antes de invocar al
 * proveedor externo para conservar trazabilidad del intento.
 */
export const registrarIntentoEntrega = async (
  {
    entregaId,
    errorDetalle = null,
  },
  tx = prisma,
) => {
  const idEntrega = validarIdEntrega(entregaId);
  const detalleNormalizado = normalizarDetalleError(errorDetalle);

  await obtenerEntregaPorId(idEntrega, tx);

  return tx.notificacionEntrega.update({
    where: {
      id: idEntrega,
    },
    data: {
      intentos: {
        increment: 1,
      },
      fecha_ultimo_intento: new Date(),
      error_detalle: detalleNormalizado,
    },
  });
};

/**
 * Registra el resultado final de una entrega.
 *
 * ENVIADA almacena la fecha efectiva y limpia errores previos.
 * ERROR conserva el detalle del fallo y no registra fecha de envío.
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
  const estadoValidado = validarEstadoEntrega(estado);
  const detalleNormalizado = normalizarDetalleError(errorDetalle);

  await obtenerEntregaPorId(idEntrega, tx);

  const esEnviada = estadoValidado === "ENVIADA";
  const esError = estadoValidado === "ERROR";

  return tx.notificacionEntrega.update({
    where: {
      id: idEntrega,
    },
    data: {
      estado: estadoValidado,
      fecha_envio: esEnviada ? new Date() : null,
      error_detalle: esError
        ? detalleNormalizado || "No fue posible completar la entrega"
        : null,
    },
  });
};