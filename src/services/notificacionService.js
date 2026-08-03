import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { validarEmail } from "../utils/validaciones.js";
import {
  crearEntrega,
  registrarIntentoEntrega,
  actualizarEstadoEntrega,
} from "./notificacionEntregaService.js";
import {
  enviarReservaConfirmada,
  enviarReservaCancelada,
  enviarReservaVencida,
  enviarNovedadPublicada,
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

const CANALES_NOTIFICACION_VALIDOS = [
  "EMAIL",
  "TELEGRAM",
];

const ORIGEN_RESERVA = "RESERVA";
const CANAL_EMAIL = "EMAIL";
const TIPO_NOVEDAD_PUBLICADA = "NOVEDAD_PUBLICADA";

const TAMANIO_LOTE_ENVIO_NOVEDADES = 5;
const ZONA_HORARIA = "America/Montevideo";

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

const validarIdPositivo = (
  valor,
  nombreCampo,
) => {
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

const validarIdSocio = (id) =>
  validarIdPositivo(
    id,
    "id del socio",
  );

const validarIdNovedad = (id) =>
  validarIdPositivo(
    id,
    "id de la novedad",
  );

const validarIdReserva = (id) =>
  validarIdPositivo(
    id,
    "id de la reserva",
  );

const validarTipoNotificacion = (tipo) => {
  const tipoNormalizado =
    typeof tipo === "string"
      ? tipo.trim().toUpperCase()
      : "";

  if (
    !TIPOS_NOTIFICACION_VALIDOS.includes(
      tipoNormalizado,
    )
  ) {
    throw new AppError(
      "El tipo de notificación indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return tipoNormalizado;
};

const validarCanalNotificacion = (canal) => {
  const canalNormalizado =
    typeof canal === "string"
      ? canal.trim().toUpperCase()
      : "";

  if (
    !CANALES_NOTIFICACION_VALIDOS.includes(
      canalNormalizado,
    )
  ) {
    throw new AppError(
      "El canal de notificación indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return canalNormalizado;
};

const validarMensaje = (mensaje) => {
  if (
    typeof mensaje !== "string" ||
    !mensaje.trim()
  ) {
    throw new AppError(
      "El mensaje de la notificación es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }

  return mensaje.trim();
};

/* =========================================================
   HELPERS DE DESTINATARIOS
========================================================= */

const normalizarEmail = (email) =>
  typeof email === "string"
    ? email.trim().toLowerCase()
    : "";

const esSocioNotificable = (
  socio,
  {
    permitirSocioNoActivo = false,
  } = {},
) => {
  if (!socio?.usuario) {
    return false;
  }

  if (
    !permitirSocioNoActivo &&
    socio.estado !== "ACTIVO"
  ) {
    return false;
  }

  if (
    !permitirSocioNoActivo &&
    socio.usuario.estado !== "ACTIVO"
  ) {
    return false;
  }

  const email = normalizarEmail(
    socio.usuario.email,
  );

  return Boolean(email) && validarEmail(email);
};

const validarSocioNotificable = (
  socio,
  {
    permitirSocioNoActivo = false,
  } = {},
) => {
  if (
    !permitirSocioNoActivo &&
    socio.estado !== "ACTIVO"
  ) {
    throw new AppError(
      "Solo socios activos pueden recibir notificaciones",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (!socio.usuario) {
    throw new AppError(
      "El socio no tiene un usuario asociado",
      400,
      "VALIDATION_ERROR",
    );
  }

  if (
    !permitirSocioNoActivo &&
    socio.usuario.estado !== "ACTIVO"
  ) {
    throw new AppError(
      "El usuario asociado al socio no se encuentra activo",
      400,
      "VALIDATION_ERROR",
    );
  }

  const email = normalizarEmail(
    socio.usuario.email,
  );

  if (!email || !validarEmail(email)) {
    throw new AppError(
      "El socio no tiene una dirección de correo electrónico válida",
      400,
      "VALIDATION_ERROR",
    );
  }

  return {
    ...socio,
    usuario: {
      ...socio.usuario,
      email,
    },
  };
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerSocioDestinatario = async (
  socioId,
  tx = prisma,
) => {
  const socio =
    await tx.socio.findUnique({
      where: {
        id: socioId,
      },
      select: socioSeguroSelect,
    });

  if (!socio) {
    throw new AppError(
      "El socio destinatario no existe",
      404,
      "NOT_FOUND",
    );
  }

  return socio;
};

const obtenerDestinatariosCandidatosNovedad =
  async (tx = prisma) => {
    const socios =
      await tx.socio.findMany({
        where: {
          estado: "ACTIVO",
          usuario: {
            estado: "ACTIVO",
          },
        },
        select: socioSeguroSelect,
        orderBy: {
          id: "asc",
        },
      });

    return socios
      .filter((socio) =>
        esSocioNotificable(socio),
      )
      .map((socio) => ({
        ...socio,
        usuario: {
          ...socio.usuario,
          email: normalizarEmail(
            socio.usuario.email,
          ),
        },
      }));
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

const actualizarEstadoNotificacion =
  async (
    {
      notificacionId,
      estado,
    },
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

const crearNotificacionConEntrega =
  async (
    {
      socioId,
      novedadId = null,
      tipo,
      mensaje,
      canal = CANAL_EMAIL,
      origenId = null,
      origenTipo = null,
      permitirSocioNoActivo = false,
      socioPrevalidado = null,
    },
    tx = prisma,
  ) => {
    const idSocio =
      validarIdSocio(socioId);

    const idNovedad =
      novedadId === null ||
      novedadId === undefined
        ? null
        : validarIdNovedad(novedadId);

    const tipoValidado =
      validarTipoNotificacion(tipo);

    const canalValidado =
      validarCanalNotificacion(canal);

    const mensajeValidado =
      validarMensaje(mensaje);

    const socioBase =
      socioPrevalidado ||
      (await obtenerSocioDestinatario(
        idSocio,
        tx,
      ));

    const socio =
      validarSocioNotificable(
        socioBase,
        {
          permitirSocioNoActivo,
        },
      );

    const notificacion =
      await crearRegistroNotificacion(
        {
          socioId: idSocio,
          novedadId: idNovedad,
          tipo: tipoValidado,
          mensaje: mensajeValidado,
          origenId,
          origenTipo,
        },
        tx,
      );

    const entrega =
      await crearEntregaInicial(
        {
          notificacionId:
            notificacion.id,
          canal: canalValidado,
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
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message.slice(
      0,
      1000,
    );
  }

  return "Error desconocido durante el envío de la notificación";
};

const registrarResultadoEntrega =
  async ({
    entregaId,
    notificacionId,
    estado,
    errorDetalle = null,
  }) => {
    await prisma.$transaction(
      async (tx) => {
        await actualizarEstadoEntrega(
          {
            entregaId,
            estado,
            errorDetalle,
          },
          tx,
        );

        await actualizarEstadoNotificacion(
          {
            notificacionId,
            estado,
          },
          tx,
        );
      },
    );
  };

const procesarContextoEntregaEmail =
  async ({
    contexto,
    enviar,
    tipo,
  }) => {
    const {
      socio,
      notificacion,
      entrega,
    } = contexto;

    try {
      await registrarIntentoEntrega({
        entregaId: entrega.id,
      });
    } catch (error) {
      const errorDetalle =
        obtenerDetalleError(error);

      console.error(
        `[NOTIFICACION] No fue posible registrar el intento de ${tipo}:`,
        error,
      );

      return {
        enviada: false,
        estadoRegistrado: false,
        notificacionId:
          notificacion.id,
        entregaId: entrega.id,
        socioId: socio.id,
        error: errorDetalle,
      };
    }

    try {
      await enviar({
        nombre: socio.nombre,
        email: socio.usuario.email,
      });
    } catch (error) {
      const errorDetalle =
        obtenerDetalleError(error);

      let estadoRegistrado = true;

      try {
        await registrarResultadoEntrega({
          entregaId: entrega.id,
          notificacionId:
            notificacion.id,
          estado: "ERROR",
          errorDetalle,
        });
      } catch (errorPersistencia) {
        estadoRegistrado = false;

        console.error(
          "[NOTIFICACION] No fue posible registrar el error de entrega:",
          errorPersistencia,
        );
      }

      console.error(
        `[NOTIFICACION] Falló el envío de ${tipo}:`,
        error,
      );

      return {
        enviada: false,
        estadoRegistrado,
        notificacionId:
          notificacion.id,
        entregaId: entrega.id,
        socioId: socio.id,
        error: errorDetalle,
      };
    }

    try {
      await registrarResultadoEntrega({
        entregaId: entrega.id,
        notificacionId:
          notificacion.id,
        estado: "ENVIADA",
      });

      return {
        enviada: true,
        estadoRegistrado: true,
        notificacionId:
          notificacion.id,
        entregaId: entrega.id,
        socioId: socio.id,
        error: null,
      };
    } catch (error) {
      const errorDetalle =
        obtenerDetalleError(error);

      console.error(
        `[NOTIFICACION] El correo de ${tipo} fue enviado, pero no fue posible registrar su resultado:`,
        error,
      );

      return {
        enviada: true,
        estadoRegistrado: false,
        notificacionId:
          notificacion.id,
        entregaId: entrega.id,
        socioId: socio.id,
        error: errorDetalle,
      };
    }
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
    contexto =
      await prisma.$transaction(
        async (tx) => {
          return crearNotificacionConEntrega(
            {
              socioId,
              tipo,
              mensaje,
              canal: CANAL_EMAIL,
              origenId,
              origenTipo:
                ORIGEN_RESERVA,
              permitirSocioNoActivo,
            },
            tx,
          );
        },
      );
  } catch (error) {
    console.error(
      `[NOTIFICACION] No fue posible registrar ${tipo}:`,
      error,
    );

    return {
      enviada: false,
      estadoRegistrado: false,
      notificacionId: null,
      entregaId: null,
      socioId:
        Number(socioId) || null,
      error:
        obtenerDetalleError(error),
    };
  }

  return procesarContextoEntregaEmail({
    contexto,
    enviar,
    tipo,
  });
};

const procesarEnLotes = async (
  elementos,
  procesarElemento,
  tamanioLote =
    TAMANIO_LOTE_ENVIO_NOVEDADES,
) => {
  const resultados = [];

  for (
    let indice = 0;
    indice < elementos.length;
    indice += tamanioLote
  ) {
    const lote = elementos.slice(
      indice,
      indice + tamanioLote,
    );

    const resultadosLote =
      await Promise.all(
        lote.map(procesarElemento),
      );

    resultados.push(
      ...resultadosLote,
    );
  }

  return resultados;
};

const formatearFechaPublicacion = (
  fecha,
) => {
  return new Intl.DateTimeFormat(
    "es-UY",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: ZONA_HORARIA,
    },
  ).format(new Date(fecha));
};

/* =========================================================
   OPERACIONES GENERALES
========================================================= */

/**
 * Crea una notificación individual
 * junto con su entrega inicial.
 */
export const crearNotificacion = async (
  {
    socioId,
    novedadId = null,
    tipo,
    mensaje,
    canal = CANAL_EMAIL,
    origenId = null,
    origenTipo = null,
  },
  tx = prisma,
) => {
  const resultado =
    await crearNotificacionConEntrega(
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
 * Genera notificaciones y entregas
 * para múltiples socios válidos.
 */
export const crearNotificacionesMasivas =
  async (
    {
      socios,
      novedadId,
      tipo,
      mensaje,
      canal = CANAL_EMAIL,
    },
    tx = prisma,
  ) => {
    const idNovedad =
      validarIdNovedad(novedadId);

    const tipoValidado =
      validarTipoNotificacion(tipo);

    const canalValidado =
      validarCanalNotificacion(canal);

    const mensajeValidado =
      validarMensaje(mensaje);

    if (!Array.isArray(socios)) {
      throw new AppError(
        "La lista de socios destinatarios es inválida",
        400,
        "VALIDATION_ERROR",
      );
    }

    const notificaciones = [];

    for (
      const socioReferencia
      of socios
    ) {
      const idSocio =
        validarIdSocio(
          socioReferencia?.id,
        );

      const socio =
        await obtenerSocioDestinatario(
          idSocio,
          tx,
        );

      if (
        !esSocioNotificable(socio)
      ) {
        continue;
      }

      const contexto =
        await crearNotificacionConEntrega(
          {
            socioId: idSocio,
            novedadId: idNovedad,
            tipo: tipoValidado,
            mensaje:
              mensajeValidado,
            canal: canalValidado,
            socioPrevalidado:
              socio,
          },
          tx,
        );

      notificaciones.push(
        contexto.notificacion,
      );
    }

    return notificaciones;
  };

/* =========================================================
   NOTIFICACIONES DE NOVEDADES
========================================================= */

/**
 * Identifica destinatarios válidos y crea,
 * dentro de la transacción de publicación,
 * una notificación y una entrega PENDIENTE
 * para cada socio.
 */
export const prepararNotificacionesNovedad =
  async (
    {
      novedadId,
      titulo,
    },
    tx = prisma,
  ) => {
    const idNovedad =
      validarIdNovedad(novedadId);

    const tituloNormalizado =
      validarMensaje(titulo);

    const destinatarios =
      await obtenerDestinatariosCandidatosNovedad(
        tx,
      );

    const contextos = [];

    for (
      const socio
      of destinatarios
    ) {
      const contexto =
        await crearNotificacionConEntrega(
          {
            socioId: socio.id,
            novedadId: idNovedad,
            tipo:
              TIPO_NOVEDAD_PUBLICADA,
            mensaje:
              `Nueva novedad publicada: ${tituloNormalizado}`,
            canal: CANAL_EMAIL,
            socioPrevalidado:
              socio,
          },
          tx,
        );

      contextos.push(contexto);
    }

    return contextos;
  };

/**
 * Procesa cada correo después del commit.
 *
 * Cada entrega se resuelve independientemente
 * y los envíos se ejecutan en lotes acotados
 * para evitar saturar el proveedor SMTP.
 */
export const procesarNotificacionesNovedad =
  async ({
    novedad,
    contextos,
  }) => {
    if (!Array.isArray(contextos)) {
      throw new AppError(
        "Las entregas de la novedad son inválidas",
        500,
        "INTERNAL_ERROR",
      );
    }

    if (contextos.length === 0) {
      return {
        total: 0,
        enviadas: 0,
        errores: 0,
        estadosNoRegistrados: 0,
        resultados: [],
      };
    }

    const fechaPublicacion =
      formatearFechaPublicacion(
        novedad.fecha_creacion,
      );

    const resultados =
      await procesarEnLotes(
        contextos,
        (contexto) =>
          procesarContextoEntregaEmail({
            contexto,
            tipo:
              TIPO_NOVEDAD_PUBLICADA,
            enviar: ({
              nombre,
              email,
            }) =>
              enviarNovedadPublicada({
                nombre,
                email,
                titulo:
                  novedad.titulo,
                contenido:
                  novedad.contenido,
                fechaPublicacion,
              }),
          }),
      );

    return {
      total: resultados.length,
      enviadas:
        resultados.filter(
          (resultado) =>
            resultado.enviada,
        ).length,
      errores:
        resultados.filter(
          (resultado) =>
            !resultado.enviada,
        ).length,
      estadosNoRegistrados:
        resultados.filter(
          (resultado) =>
            !resultado.estadoRegistrado,
        ).length,
      resultados,
    };
  };

/* =========================================================
   NOTIFICACIONES DE RESERVAS
========================================================= */

export const notificarReservaConfirmada =
  async ({
    socioId,
    reservaId,
    fechaLimiteRetiro,
    detalles,
    total,
  }) => {
    const idReserva =
      validarIdReserva(reservaId);

    const mensaje =
      `La reserva #${idReserva} fue confirmada correctamente.`;

    return procesarEntregaEmail({
      socioId,
      tipo: "RESERVA_CONFIRMADA",
      mensaje,
      origenId: idReserva,
      enviar: ({
        nombre,
        email,
      }) =>
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

export const notificarReservaCancelada =
  async ({
    socioId,
    reservaId,
    motivo = null,
    cancelacionPorSuspension = false,
    detalles,
    total,
  }) => {
    const idReserva =
      validarIdReserva(reservaId);

    const mensaje = motivo
      ? `La reserva #${idReserva} fue cancelada. Motivo: ${motivo}`
      : `La reserva #${idReserva} fue cancelada.`;

    return procesarEntregaEmail({
      socioId,
      tipo: "RESERVA_CANCELADA",
      mensaje,
      origenId: idReserva,
      permitirSocioNoActivo:
        cancelacionPorSuspension,
      enviar: ({
        nombre,
        email,
      }) =>
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

export const notificarReservaVencida =
  async ({
    socioId,
    reservaId,
    detalles,
    total,
  }) => {
    const idReserva =
      validarIdReserva(reservaId);

    const mensaje =
      `La reserva #${idReserva} venció y el stock reservado fue liberado.`;

    return procesarEntregaEmail({
      socioId,
      tipo: "RESERVA_VENCIDA",
      mensaje,
      origenId: idReserva,
      enviar: ({
        nombre,
        email,
      }) =>
        enviarReservaVencida({
          nombre,
          email,
          reservaId: idReserva,
          detalles,
          total,
        }),
    });
  };