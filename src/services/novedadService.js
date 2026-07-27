import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  crearNotificacionesMasivas,
} from "./notificacionService.js";
import {
  registrarAuditoria,
} from "./auditoriaService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const ESTADOS_NOVEDAD_VALIDOS = [
  "ACTIVA",
  "INACTIVA",
];


/* =========================================================
   SELECTORES SEGUROS
========================================================= */

const socioActivoSelect = {
  id: true,
  estado: true,
  usuario: {
    select: {
      id: true,
      estado: true,
    },
  },
};


const novedadAdminSelect = {
  id: true,
  titulo: true,
  contenido: true,
  estado: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
  usuario: {
    select: {
      id: true,
      email: true,
    },
  },
};


/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

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


const validarTitulo = (titulo) => {
  if (!titulo || !titulo.trim()) {
    throw new AppError(
      "El título de la novedad es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }

  return titulo.trim();
};


const validarContenido = (contenido) => {
  if (!contenido || !contenido.trim()) {
    throw new AppError(
      "El contenido de la novedad es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }

  return contenido.trim();
};


const validarEstadoNovedad = (estado) => {
  if (!ESTADOS_NOVEDAD_VALIDOS.includes(estado)) {
    throw new AppError(
      "El estado de novedad indicado no es válido",
      400,
      "VALIDATION_ERROR",
    );
  }

  return estado;
};


/*
  Valida que el caso de uso reciba únicamente
  los campos permitidos para crear una novedad.

  Estado no pertenece al contrato de creación,
  ya que toda novedad nace ACTIVA.
*/
const validarCamposCreacionNovedad = (
  camposExtra,
) => {

  const camposInvalidos =
    Object.keys(camposExtra);


  if (camposInvalidos.length > 0) {
    throw new AppError(
      `Los siguientes campos no están permitidos al crear una novedad: ${camposInvalidos.join(", ")}`,
      400,
      "VALIDATION_ERROR",
    );
  }
};


/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerSociosActivos = async (
  tx = prisma,
) => {
  return tx.socio.findMany({
    where: {
      estado: "ACTIVO",
      usuario: {
        estado: "ACTIVO",
      },
    },
    select: socioActivoSelect,
  });
};


const obtenerNovedadExistente = async (
  novedadId,
  tx = prisma,
) => {

  const novedad =
    await tx.novedad.findUnique({
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


/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

const validarDatosNovedad = ({
  titulo,
  contenido,
}) => {

  validarTitulo(titulo);

  validarContenido(contenido);
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
  });
};


/* =========================================================
   HELPERS DE AUDITORÍA
========================================================= */

const auditarCreacionNovedad = async (
  {
    usuarioId,
    novedadId,
    titulo,
    cantidadNotificaciones,
  },
  tx,
) => {

  await registrarAuditoria(
    {
      usuarioId,
      accion: "CREAR_NOVEDAD",
      entidad: "Novedad",
      entidadId: novedadId,
      detalle:
        `Novedad "${titulo}" creada y publicada. ` +
        `Se generaron ${cantidadNotificaciones} notificaciones.`,
    },
    tx,
  );
};


/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const obtenerNovedades = async () => {

  return prisma.novedad.findMany({
    orderBy: {
      fecha_creacion: "desc",
    },
    select: novedadAdminSelect,
  });
};


export const obtenerNovedadPorId = async (
  novedadId,
) => {

  const idNovedad =
    validarIdNovedad(novedadId);


  return obtenerNovedadExistente(
    idNovedad,
  );
};


/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */


/**
 * Crea una novedad administrativa.
 *
 * Flujo:
 *
 * Crear Novedad ACTIVA
 *        ↓
 * Buscar socios activos
 *        ↓
 * Generar notificaciones
 *        ↓
 * Registrar auditoría
 */
export const crearNovedad = async ({
  titulo,
  contenido,
  usuarioId,
  ...camposExtra
}) => {


  if (!usuarioId) {
    throw new AppError(
      "El usuario administrador es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }


  validarCamposCreacionNovedad(
    camposExtra,
  );


  const tituloNormalizado =
    validarTitulo(titulo);


  const contenidoNormalizado =
    validarContenido(contenido);



  return prisma.$transaction(async (tx) => {


    const novedad =
      await crearRegistroNovedad(
        {
          titulo: tituloNormalizado,
          contenido: contenidoNormalizado,
          usuarioId,
        },
        tx,
      );


    const sociosActivos =
      await obtenerSociosActivos(tx);


    let notificaciones = [];


    if (sociosActivos.length > 0) {

      notificaciones =
        await crearNotificacionesMasivas(
          {
            socios: sociosActivos,
            novedadId: novedad.id,
            tipo: "NOVEDAD_PUBLICADA",
            mensaje: contenidoNormalizado,
            canal: "EMAIL",
          },
          tx,
        );
    }


    await auditarCreacionNovedad(
      {
        usuarioId,
        novedadId: novedad.id,
        titulo: novedad.titulo,
        cantidadNotificaciones:
          notificaciones.length,
      },
      tx,
    );


    return {
      ...novedad,
      cantidadNotificaciones:
        notificaciones.length,
    };
  });
};


/**
 * Cambia el estado administrativo de una novedad.
 */
export const cambiarEstadoNovedad = async ({
  novedadId,
  estado,
  usuarioId,
}) => {


  const idNovedad =
    validarIdNovedad(novedadId);


  validarEstadoNovedad(estado);


  if (!usuarioId) {
    throw new AppError(
      "El usuario responsable es obligatorio",
      400,
      "VALIDATION_ERROR",
    );
  }


  const novedad =
    await obtenerNovedadExistente(
      idNovedad,
    );


  return prisma.$transaction(async (tx) => {


    const novedadActualizada =
      await tx.novedad.update({
        where: {
          id: idNovedad,
        },
        data: {
          estado,
        },
        select: novedadAdminSelect,
      });


    await registrarAuditoria(
      {
        usuarioId,
        accion: "CAMBIAR_ESTADO_NOVEDAD",
        entidad: "Novedad",
        entidadId: idNovedad,
        detalle:
          `Estado cambiado de ${novedad.estado} a ${estado}.`,
      },
      tx,
    );


    return novedadActualizada;
  });
};