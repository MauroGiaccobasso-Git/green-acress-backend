import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { crearEntrega } from "./notificacionEntregaService.js";

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

const CANALES_NOTIFICACION_VALIDOS = [
  "EMAIL",
  "TELEGRAM",
];


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
    throw new AppError(
      "El id del socio es inválido",
      400,
    );
  }

  return socioId;
};


const validarIdNovedad = (id) => {
  const novedadId = Number(id);

  if (!Number.isInteger(novedadId) || novedadId <= 0) {
    throw new AppError(
      "El id de la novedad es inválido",
      400,
    );
  }

  return novedadId;
};


const validarTipoNotificacion = (tipo) => {
  if (!TIPOS_NOTIFICACION_VALIDOS.includes(tipo)) {
    throw new AppError(
      "El tipo de notificación indicado no es válido",
      400,
    );
  }

  return tipo;
};


const validarCanalNotificacion = (canal) => {
  if (!CANALES_NOTIFICACION_VALIDOS.includes(canal)) {
    throw new AppError(
      "El canal de notificación indicado no es válido",
      400,
    );
  }

  return canal;
};


/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerSocioDestinatario = async (
  socioId,
  tx = prisma,
) => {
  const socio = await tx.socio.findUnique({
    where: {
      id: socioId,
    },
    select: socioSeguroSelect,
  });

  if (!socio) {
    throw new AppError(
      "El socio destinatario no existe",
      404,
    );
  }

  return socio;
};


/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

const validarSocioNotificable = (socio) => {
  if (socio.estado !== "ACTIVO") {
    throw new AppError(
      "Solo socios activos pueden recibir notificaciones",
      400,
    );
  }

  if (!socio.usuario || socio.usuario.estado !== "ACTIVO") {
    throw new AppError(
      "El usuario asociado al socio no se encuentra activo",
      400,
    );
  }
};


/* =========================================================
   HELPERS DE PERSISTENCIA
========================================================= */

const crearRegistroNotificacion = async (
  {
    socioId,
    novedadId,
    tipo,
    mensaje,
    origenId = null,
    origenTipo = null,
  },
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


const crearEntregaInicial = async (
  {
    notificacionId,
    canal,
  },
  tx,
) => {
  return crearEntrega(
    {
      notificacionId,
      canal,
    },
    tx,
  );
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
  const idSocio = validarIdSocio(socioId);

  const idNovedad = novedadId
    ? validarIdNovedad(novedadId)
    : null;

  validarTipoNotificacion(tipo);
  validarCanalNotificacion(canal);

  const socio = await obtenerSocioDestinatario(
    idSocio,
    tx,
  );

  validarSocioNotificable(socio);

  const notificacion =
    await crearRegistroNotificacion(
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

  await crearEntregaInicial(
    {
      notificacionId: notificacion.id,
      canal,
    },
    tx,
  );

  return notificacion;
};


/**
 * Genera notificaciones para múltiples socios.
 */
export const crearNotificacionesMasivas = async (
  {
    socios,
    novedadId,
    tipo,
    mensaje,
    canal = "EMAIL",
  },
  tx = prisma,
) => {
  const idNovedad = validarIdNovedad(novedadId);

  validarTipoNotificacion(tipo);
  validarCanalNotificacion(canal);

  if (!Array.isArray(socios) || socios.length === 0) {
    throw new AppError(
      "Debe existir al menos un socio destinatario",
      400,
    );
  }

  const notificaciones = [];

  for (const socio of socios) {
    const notificacion =
      await crearNotificacion(
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