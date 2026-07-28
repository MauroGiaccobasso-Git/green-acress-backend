import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  crearEntrega,
  registrarIntentoEntrega,
  actualizarEstadoEntrega,
} from "./notificacionEntregaService.js";
import {
  enviarReservaConfirmada,
  enviarReservaCancelada,
  enviarReservaVencida,
} from "./email/emailService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const TIPOS_NOTIFICACION_VALIDOS = [
  "PASSWORD_TEMPORAL_GENERADA",
  "PASSWORD_ACTUALIZADA",
  "RECUPERACION_PASSWORD",
  "MFA_ACTIVADO",
  "RESERVA_CONFIRMADA",
  "RESERVA_RECHAZADA",
  "RESERVA_CANCELADA",
  "RESERVA_VENCIDA",
  "VENTA_ANULADA",
  "NOVEDAD_PUBLICADA",
];

const CANALES_NOTIFICACION_VALIDOS = ["EMAIL", "TELEGRAM"];

const ORIGEN_RESERVA = "RESERVA";

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

const socioSeguroSelect = {
  id: true,
  nombre: true,
  apellido: true,
  estado: true,
  usuario: {
    select: {
      id: true,
      email: true,
      estado: true,
    },
  },
};

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

const validarIdNovedad = (id) => {
  const novedadId = Number(id);

  if (!Number.isInteger(novedadId) || novedadId <= 0) {
    throw new AppError("El id de la novedad es inválido", 400);
  }

  return novedadId;
};

const validarIdReserva = (id) => {
  const reservaId = Number(id);

  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    throw new AppError("El id de la reserva es inválido", 400);
  }

  return reservaId;
};

const validarTipoNotificacion = (tipo) => {
  if (!TIPOS_NOTIFICACION_VALIDOS.includes(tipo)) {
    throw new AppError("El tipo de notificación indicado no es válido", 400);
  }

  return tipo;
};

const validarCanalNotificacion = (canal) => {
  if (!CANALES_NOTIFICACION_VALIDOS.includes(canal)) {
    throw new AppError("El canal de notificación indicado no es válido", 400);
  }

  return canal;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerSocioDestinatario = async (socioId, tx = prisma) => {
  const socio = await tx.socio.findUnique({
    where: {
      id: socioId,
    },
    select: socioSeguroSelect,
  });

  if (!socio) {
    throw new AppError("El socio destinatario no existe", 404);
  }

  return socio;
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

const validarSocioNotificable = (
  socio,
  { permitirSocioNoActivo = false } = {},
) => {
  if (!permitirSocioNoActivo && socio.estado !== "ACTIVO") {
    throw new AppError(
      "Solo socios activos pueden recibir notificaciones",
      400,
    );
  }

  if (
    !permitirSocioNoActivo &&
    (!socio.usuario || socio.usuario.estado !== "ACTIVO")
  ) {
    throw new AppError(
      "El usuario asociado al socio no se encuentra activo",
      400,
    );
  }

  if (!socio.usuario?.email) {
    throw new AppError(
      "El socio no tiene una dirección de correo electrónico válida",
      400,
    );
  }
};

/* =========================================================
   HELPERS DE PERSISTENCIA
========================================================= */

const crearRegistroNotificacion = async (
  { socioId, novedadId, tipo, mensaje, origenId = null, origenTipo = null },
  tx,
) => {
  return tx.notificacion.create({
    data: {
      socio_id: socioId,
      novedad_id: novedadId,
      tipo,
      mensaje,
      origen_id: origenId,
      origen_tipo: origenTipo,
    },
  });
};

const crearEntregaInicial = async ({ notificacionId, canal }, tx) => {
  return crearEntrega(
    {
      notificacionId,
      canal,
    },
    tx,
  );
};

const actualizarEstadoNotificacion = async (
  { notificacionId, estado },
  tx = prisma,
) => {
  return tx.notificacion.update({
    where: {
      id: notificacionId,
    },
    data: {
      estado,
    },
  });
};

const crearNotificacionConEntrega = async (
  {
    socioId,
    novedadId = null,
    tipo,
    mensaje,
    canal = "EMAIL",
    origenId = null,
    origenTipo = null,
    permitirSocioNoActivo = false,
  },
  tx = prisma,
) => {
  const idSocio = validarIdSocio(socioId);

  const idNovedad = novedadId ? validarIdNovedad(novedadId) : null;

  validarTipoNotificacion(tipo);
  validarCanalNotificacion(canal);

  const socio = await obtenerSocioDestinatario(idSocio, tx);

  validarSocioNotificable(socio, {
    permitirSocioNoActivo,
  });

  const notificacion = await crearRegistroNotificacion(
    {
      socioId: idSocio,
      novedadId: idNovedad,
      tipo,
      mensaje,
      origenId,
      origenTipo,
    },
    tx,
  );

  const entrega = await crearEntregaInicial(
    {
      notificacionId: notificacion.id,
      canal,
    },
    tx,
  );

  return {
    socio,
    notificacion,
    entrega,
  };
};

/* =========================================================
   PROCESAMIENTO DE ENTREGAS
========================================================= */

const obtenerDetalleError = (error) => {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 1000);
  }

  return "Error desconocido durante el envío de la notificación";
};

const procesarEntregaEmail = async ({
  socioId,
  tipo,
  mensaje,
  origenId,
  enviar,
  permitirSocioNoActivo = false,
}) => {
  let contexto;

  try {
    contexto = await prisma.$transaction(async (tx) => {
      return crearNotificacionConEntrega(
        {
          socioId,
          tipo,
          mensaje,
          canal: "EMAIL",
          origenId,
          origenTipo: ORIGEN_RESERVA,
          permitirSocioNoActivo,
        },
        tx,
      );
    });
  } catch (error) {
    console.error(`[NOTIFICACION] No fue posible registrar ${tipo}:`, error);

    return {
      enviada: false,
      notificacionId: null,
      error: obtenerDetalleError(error),
    };
  }

  const { socio, notificacion, entrega } = contexto;

  try {
    await registrarIntentoEntrega({
      entregaId: entrega.id,
    });

    await enviar({
      nombre: socio.nombre,
      email: socio.usuario.email,
    });

    await prisma.$transaction(async (tx) => {
      await actualizarEstadoEntrega(
        {
          entregaId: entrega.id,
          estado: "ENVIADA",
        },
        tx,
      );

      await actualizarEstadoNotificacion(
        {
          notificacionId: notificacion.id,
          estado: "ENVIADA",
        },
        tx,
      );
    });

    return {
      enviada: true,
      notificacionId: notificacion.id,
      error: null,
    };
  } catch (error) {
    const errorDetalle = obtenerDetalleError(error);

    try {
      await prisma.$transaction(async (tx) => {
        await actualizarEstadoEntrega(
          {
            entregaId: entrega.id,
            estado: "ERROR",
            errorDetalle,
          },
          tx,
        );

        await actualizarEstadoNotificacion(
          {
            notificacionId: notificacion.id,
            estado: "ERROR",
          },
          tx,
        );
      });
    } catch (errorPersistencia) {
      console.error(
        "[NOTIFICACION] No fue posible registrar el error de entrega:",
        errorPersistencia,
      );
    }

    console.error(`[NOTIFICACION] Falló el envío de ${tipo}:`, error);

    return {
      enviada: false,
      notificacionId: notificacion.id,
      error: errorDetalle,
    };
  }
};

/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */

/**
 * Crea una notificación individual para un socio.
 *
 * Puede estar asociada a una novedad o ser generada
 * por otro evento del sistema.
 */
export const crearNotificacion = async (
  {
    socioId,
    novedadId = null,
    tipo,
    mensaje,
    canal = "EMAIL",
    origenId = null,
    origenTipo = null,
  },
  tx = prisma,
) => {
  const resultado = await crearNotificacionConEntrega(
    {
      socioId,
      novedadId,
      tipo,
      mensaje,
      canal,
      origenId,
      origenTipo,
    },
    tx,
  );

  return resultado.notificacion;
};

/**
 * Genera notificaciones para múltiples socios.
 */
export const crearNotificacionesMasivas = async (
  { socios, novedadId, tipo, mensaje, canal = "EMAIL" },
  tx = prisma,
) => {
  const idNovedad = validarIdNovedad(novedadId);

  validarTipoNotificacion(tipo);
  validarCanalNotificacion(canal);

  if (!Array.isArray(socios) || socios.length === 0) {
    throw new AppError("Debe existir al menos un socio destinatario", 400);
  }

  const notificaciones = [];

  for (const socio of socios) {
    const notificacion = await crearNotificacion(
      {
        socioId: socio.id,
        novedadId: idNovedad,
        tipo,
        mensaje,
        canal,
      },
      tx,
    );

    notificaciones.push(notificacion);
  }

  return notificaciones;
};

/* =========================================================
   NOTIFICACIONES DE RESERVAS
========================================================= */

export const notificarReservaConfirmada = async ({
  socioId,
  reservaId,
  fechaLimiteRetiro,
  detalles,
  total,
}) => {
  const idReserva = validarIdReserva(reservaId);

  const mensaje = `La reserva #${idReserva} fue confirmada correctamente.`;

  return procesarEntregaEmail({
    socioId,
    tipo: "RESERVA_CONFIRMADA",
    mensaje,
    origenId: idReserva,
    enviar: ({ nombre, email }) =>
      enviarReservaConfirmada({
        nombre,
        email,
        reservaId: idReserva,
        fechaLimiteRetiro,
        detalles,
        total,
      }),
  });
};

export const notificarReservaCancelada = async ({
  socioId,
  reservaId,
  motivo = null,
  cancelacionPorSuspension = false,
  detalles,
  total,
}) => {
  const idReserva = validarIdReserva(reservaId);

  const mensaje = motivo
    ? `La reserva #${idReserva} fue cancelada. Motivo: ${motivo}`
    : `La reserva #${idReserva} fue cancelada.`;

  return procesarEntregaEmail({
    socioId,
    tipo: "RESERVA_CANCELADA",
    mensaje,
    origenId: idReserva,
    permitirSocioNoActivo: cancelacionPorSuspension,
    enviar: ({ nombre, email }) =>
      enviarReservaCancelada({
        nombre,
        email,
        reservaId: idReserva,
        motivo,
        detalles,
        total,
      }),
  });
};

export const notificarReservaVencida = async ({
  socioId,
  reservaId,
  detalles,
  total,
}) => {
  const idReserva = validarIdReserva(reservaId);

  const mensaje = `La reserva #${idReserva} venció y el stock reservado fue liberado.`;

  return procesarEntregaEmail({
    socioId,
    tipo: "RESERVA_VENCIDA",
    mensaje,
    origenId: idReserva,
    enviar: ({ nombre, email }) =>
      enviarReservaVencida({
        nombre,
        email,
        reservaId: idReserva,
        detalles,
        total,
      }),
  });
};
