import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  prepararNotificacionesNovedad,
  procesarNotificacionesNovedad,
} from "./notificacionService.js";
import { registrarAuditoria } from "./auditoriaService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const ESTADOS_NOVEDAD_VALIDOS = ["ACTIVA", "INACTIVA"];

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

const novedadBaseSelect = {
  id: true,
  titulo: true,
  contenido: true,
  estado: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
};

const novedadAdminSelect = {
  ...novedadBaseSelect,
  usuario: {
    select: {
      id: true,
      email: true,
    },
  },
  _count: {
    select: {
      notificaciones: true,
    },
  },
};

const novedadPortalSelect = {
  titulo: true,
  contenido: true,
  fecha_creacion: true,
};

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

const validarIdNovedad = (id) =>
  validarIdPositivo(id, "id de la novedad");

const validarIdUsuario = (id) =>
  validarIdPositivo(id, "id del usuario administrador");

const validarTitulo = (titulo) => {
  if (typeof titulo !== "string" || !titulo.trim()) {
    throw new AppError(
      "El título de la novedad es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }

  return titulo.trim().replace(/\s+/g, " ");
};

const validarContenido = (contenido) => {
  if (typeof contenido !== "string" || !contenido.trim()) {
    throw new AppError(
      "El contenido de la novedad es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }

  return contenido.trim();
};

const validarEstadoNovedad = (estado) => {
  const estadoNormalizado = String(estado ?? "")
    .trim()
    .toUpperCase();

  if (!ESTADOS_NOVEDAD_VALIDOS.includes(estadoNormalizado)) {
    throw new AppError(
      "El estado de novedad indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return estadoNormalizado;
};

const validarPayload = (payload, nombrePayload) => {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AppError(
      `Los datos para ${nombrePayload} la novedad son inválidos`,
      400,
      "VALIDATION_ERROR",
    );
  }

  return payload;
};

const validarCamposPermitidos = (camposExtra, operacion) => {
  const camposInvalidos = Object.keys(camposExtra);

  if (camposInvalidos.length > 0) {
    throw new AppError(
      `Los siguientes campos no están permitidos al ${operacion} una novedad: ${camposInvalidos.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

const construirWhereNovedades = ({
  search = "",
  estado,
} = {}) => {
  const filtros = [];
  const searchNormalizado = String(search ?? "").trim();

  if (searchNormalizado) {
    filtros.push({
      OR: [
        {
          titulo: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
        {
          contenido: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (
    estado !== undefined &&
    estado !== null &&
    String(estado).trim()
  ) {
    filtros.push({
      estado: validarEstadoNovedad(estado),
    });
  }

  return filtros.length > 0
    ? {
        AND: filtros,
      }
    : undefined;
};

/* =========================================================
   HELPERS DE BÚSQUEDA Y TRANSFORMACIÓN
========================================================= */

const obtenerNovedadExistente = async (
  novedadId,
  tx = prisma,
) => {
  const novedad = await tx.novedad.findUnique({
    where: {
      id: novedadId,
    },
    select: novedadAdminSelect,
  });

  if (!novedad) {
    throw new AppError(
      "La novedad indicada no existe",
      404,
      "NOT_FOUND",
    );
  }

  return novedad;
};

const mapearNovedadAdmin = (novedad) => {
  const { _count, ...datosNovedad } = novedad;

  return {
    ...datosNovedad,
    cantidadNotificaciones:
      _count?.notificaciones ?? 0,
  };
};

const obtenerResumenEntregasNovedad = async (
  novedadId,
  tx = prisma,
) => {
  const where = {
    notificacion: {
      is: {
        novedad_id: novedadId,
      },
    },
  };

  const [
    total,
    pendientes,
    enviadas,
    errores,
  ] = await Promise.all([
    tx.notificacionEntrega.count({
      where,
    }),

    tx.notificacionEntrega.count({
      where: {
        ...where,
        estado: "PENDIENTE",
      },
    }),

    tx.notificacionEntrega.count({
      where: {
        ...where,
        estado: "ENVIADA",
      },
    }),

    tx.notificacionEntrega.count({
      where: {
        ...where,
        estado: "ERROR",
      },
    }),
  ]);

  return {
    total,
    pendientes,
    enviadas,
    errores,
  };
};

/* =========================================================
   HELPERS DE PERSISTENCIA
========================================================= */

const crearRegistroNovedad = async (
  {
    titulo,
    contenido,
    usuarioId,
  },
  tx,
) => {
  return tx.novedad.create({
    data: {
      titulo,
      contenido,
      estado: "ACTIVA",
      usuario_id: usuarioId,
    },
    select: novedadBaseSelect,
  });
};

/* =========================================================
   HELPERS DE AUDITORÍA
========================================================= */

const auditarCreacionNovedad = async (
  {
    usuarioId,
    novedad,
    cantidadNotificaciones,
  },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CREAR_NOVEDAD",
      entidad: "Novedad",
      entidadId: novedad.id,
      detalle:
        `Novedad "${novedad.titulo}" creada y publicada en estado ACTIVA. ` +
        `Se generaron ${cantidadNotificaciones} notificaciones por email.`,
    },
    tx,
  );
};

const auditarCambioEstadoNovedad = async (
  {
    usuarioId,
    novedad,
    estadoAnterior,
  },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CAMBIAR_ESTADO_NOVEDAD",
      entidad: "Novedad",
      entidadId: novedad.id,
      detalle:
        `Novedad "${novedad.titulo}" cambió de ` +
        `${estadoAnterior} a ${novedad.estado}.`,
    },
    tx,
  );
};

/* =========================================================
   PROCESAMIENTO POSTERIOR AL COMMIT
========================================================= */

const resumirResultadoEnvios = (resultado) => ({
  total: resultado.total,
  enviadas: resultado.enviadas,
  errores: resultado.errores,
  estadosNoRegistrados:
    resultado.estadosNoRegistrados,
  procesamientoCompleto:
    resultado.estadosNoRegistrados === 0,
});

const procesarEnviosLuegoDelCommit = async ({
  novedad,
  contextos,
}) => {
  try {
    const resultado =
      await procesarNotificacionesNovedad({
        novedad,
        contextos,
      });

    return resumirResultadoEnvios(resultado);
  } catch (error) {
    /*
      La publicación ya fue confirmada.

      Un fallo inesperado del proveedor o del procesamiento
      posterior no debe devolver un error que induzca al
      administrador a publicar nuevamente la misma novedad.
    */
    console.error(
      `[NOVEDADES] La novedad #${novedad.id} fue publicada, pero ocurrió un error inesperado al procesar sus entregas:`,
      error,
    );

    return {
      total: contextos.length,
      enviadas: null,
      errores: null,
      estadosNoRegistrados: null,
      procesamientoCompleto: false,
    };
  }
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const obtenerNovedades = async ({
  search = "",
  estado,
} = {}) => {
  const where = construirWhereNovedades({
    search,
    estado,
  });

  const novedades =
    await prisma.novedad.findMany({
      where,
      orderBy: [
        {
          fecha_creacion: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: novedadAdminSelect,
    });

  return novedades.map(mapearNovedadAdmin);
};

export const obtenerNovedadPorId = async (
  novedadId,
) => {
  const idNovedad =
    validarIdNovedad(novedadId);

  const [
    novedad,
    resumenEntregas,
  ] = await Promise.all([
    obtenerNovedadExistente(idNovedad),
    obtenerResumenEntregasNovedad(
      idNovedad,
    ),
  ]);

  return {
    ...mapearNovedadAdmin(novedad),
    resumenEntregas,
  };
};

/* =========================================================
   CONSULTAS DEL PORTAL DEL SOCIO
========================================================= */

export const obtenerNovedadesActivas =
  async () => {
    return prisma.novedad.findMany({
      where: {
        estado: "ACTIVA",
      },
      orderBy: [
        {
          fecha_creacion: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: novedadPortalSelect,
    });
  };

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

/**
 * Publica una novedad en estado ACTIVA.
 *
 * La novedad, sus notificaciones, las entregas pendientes
 * y la auditoría se persisten en una única transacción.
 *
 * Los correos se procesan únicamente después del commit.
 */
export const crearNovedad = async ({
  datosNovedad,
  usuarioId,
}) => {
  const payload = validarPayload(
    datosNovedad,
    "crear",
  );

  const {
    titulo,
    contenido,
    ...camposExtra
  } = payload;

  validarCamposPermitidos(
    camposExtra,
    "crear",
  );

  const idUsuario =
    validarIdUsuario(usuarioId);

  const tituloNormalizado =
    validarTitulo(titulo);

  const contenidoNormalizado =
    validarContenido(contenido);

  const resultadoPersistencia =
    await prisma.$transaction(
      async (tx) => {
        const novedad =
          await crearRegistroNovedad(
            {
              titulo:
                tituloNormalizado,
              contenido:
                contenidoNormalizado,
              usuarioId: idUsuario,
            },
            tx,
          );

        const contextos =
          await prepararNotificacionesNovedad(
            {
              novedadId: novedad.id,
              titulo: novedad.titulo,
            },
            tx,
          );

        await auditarCreacionNovedad(
          {
            usuarioId: idUsuario,
            novedad,
            cantidadNotificaciones:
              contextos.length,
          },
          tx,
        );

        const novedadPublicada =
          await obtenerNovedadExistente(
            novedad.id,
            tx,
          );

        return {
          novedad:
            novedadPublicada,
          contextos,
        };
      },
    );

  const resultadoEnvios =
    await procesarEnviosLuegoDelCommit({
      novedad:
        resultadoPersistencia.novedad,
      contextos:
        resultadoPersistencia.contextos,
    });

  return {
    ...mapearNovedadAdmin(
      resultadoPersistencia.novedad,
    ),
    resultadoEnvios,
  };
};

/**
 * Modifica exclusivamente el estado de una novedad.
 *
 * No permite actualizar título, contenido ni solicitar
 * nuevamente el estado actual.
 *
 * El cambio de estado no genera nuevas notificaciones.
 */
export const cambiarEstadoNovedad = async ({
  novedadId,
  datosEstado,
  usuarioId,
}) => {
  const payload = validarPayload(
    datosEstado,
    "actualizar",
  );

  const {
    estado,
    ...camposExtra
  } = payload;

  validarCamposPermitidos(
    camposExtra,
    "actualizar",
  );

  const idNovedad =
    validarIdNovedad(novedadId);

  const idUsuario =
    validarIdUsuario(usuarioId);

  const estadoNormalizado =
    validarEstadoNovedad(estado);

  return prisma.$transaction(
    async (tx) => {
      const novedadExistente =
        await obtenerNovedadExistente(
          idNovedad,
          tx,
        );

      if (
        novedadExistente.estado ===
        estadoNormalizado
      ) {
        throw new AppError(
          `La novedad ya se encuentra ${estadoNormalizado.toLowerCase()}`,
          400,
          "VALIDATION_ERROR",
        );
      }

      /*
        La condición sobre el estado anterior evita que dos
        cambios concurrentes sobrescriban silenciosamente
        información desactualizada.
      */
      const actualizacion =
        await tx.novedad.updateMany({
          where: {
            id: idNovedad,
            estado:
              novedadExistente.estado,
          },
          data: {
            estado:
              estadoNormalizado,
          },
        });

      if (actualizacion.count !== 1) {
        throw new AppError(
          "La novedad fue modificada por otra operación. Actualizá la información e intentá nuevamente",
          409,
          "CONFLICT",
        );
      }

      const novedadActualizada =
        await obtenerNovedadExistente(
          idNovedad,
          tx,
        );

      await auditarCambioEstadoNovedad(
        {
          usuarioId: idUsuario,
          novedad:
            novedadActualizada,
          estadoAnterior:
            novedadExistente.estado,
        },
        tx,
      );

      return mapearNovedadAdmin(
        novedadActualizada,
      );
    },
  );
};