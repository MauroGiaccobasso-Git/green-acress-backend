import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  validarDocumento,
  validarEmail,
  validarPassword,
  validarTelefono,
  validarTexto,
} from "../utils/validaciones.js";
import { registrarAuditoria } from "./auditoriaService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const ESTADOS_SOCIO_VALIDOS = ["ACTIVO", "INACTIVO", "SUSPENDIDO"];
const ESTADOS_USUARIO_VALIDOS = ["ACTIVO", "INACTIVO", "BLOQUEADO"];
const MAX_LIMIT_SOCIOS = 100;

const ESTADO_USUARIO_POR_ESTADO_SOCIO = {
  ACTIVO: "ACTIVO",
  INACTIVO: "INACTIVO",
  SUSPENDIDO: "BLOQUEADO",
};

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

// Campos seguros del usuario.
// Nunca se exponen password_hash ni datos internos de autenticación.
const usuarioSeguroSelect = {
  id: true,
  email: true,
  rol: true,
  estado: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
};

// Estructura segura para consultas administrativas y perfil del socio.
const socioSeguroSelect = {
  id: true,
  usuario_id: true,
  documento: true,
  nombre: true,
  apellido: true,
  telefono: true,
  estado: true,
  fecha_alta: true,
  consentimiento_aceptado: true,
  fecha_consentimiento: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
  usuario: {
    select: usuarioSeguroSelect,
  },
};

// Campos mínimos necesarios para identificar un socio en el selector de ventas.
const socioVentaOptionSelect = {
  id: true,
  documento: true,
  nombre: true,
  apellido: true,
};

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador del socio.
const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

// Convierte y valida el identificador del usuario responsable.
const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario administrador es obligatorio", 400);
  }

  return usuarioId;
};

/*
  Valida y normaliza los parámetros de paginación.

  La API entrega conjuntos acotados de socios para evitar
  que el frontend cargue y pagine localmente todos los registros.
*/
const validarPaginacion = ({ page = 1, limit = 5 } = {}) => {
  const pagina = Number(page);
  const limite = Number(limit);

  if (!Number.isInteger(pagina) || pagina <= 0) {
    throw new AppError("La página solicitada es inválida", 400);
  }

  if (!Number.isInteger(limite) || limite <= 0) {
    throw new AppError("El límite de registros es inválido", 400);
  }

  if (limite > MAX_LIMIT_SOCIOS) {
    throw new AppError(
      `El límite de registros no puede superar ${MAX_LIMIT_SOCIOS}`,
      400,
    );
  }

  return {
    page: pagina,
    limit: limite,
    skip: (pagina - 1) * limite,
  };
};

// Valida un estado propio de la entidad Socio.
const validarEstadoSocio = (estado) => {
  const estadoNormalizado = String(estado ?? "")
    .trim()
    .toUpperCase();

  if (!ESTADOS_SOCIO_VALIDOS.includes(estadoNormalizado)) {
    throw new AppError("El estado del socio ingresado no es válido", 400);
  }

  return estadoNormalizado;
};

// Valida un estado propio de la entidad Usuario para filtros administrativos.
const validarEstadoUsuario = (estado) => {
  const estadoNormalizado = String(estado ?? "")
    .trim()
    .toUpperCase();

  if (!ESTADOS_USUARIO_VALIDOS.includes(estadoNormalizado)) {
    throw new AppError("El estado de acceso indicado no es válido", 400);
  }

  return estadoNormalizado;
};

/* =========================================================
   HELPERS DE NORMALIZACIÓN
========================================================= */

// Normaliza textos personales sin alterar tildes ni mayúsculas elegidas.
const normalizarTexto = (valor) => {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
};

// Normaliza emails para evitar duplicados por mayúsculas o espacios.
const normalizarEmail = (email) => {
  return String(email ?? "")
    .trim()
    .toLowerCase();
};

// Normaliza campos numéricos almacenados como texto.
const normalizarDatoNumerico = (valor) => {
  return String(valor ?? "").trim();
};

// Normaliza los datos obligatorios utilizados al crear un socio.
const normalizarDatosCreacionSocio = ({
  email,
  password,
  documento,
  nombre,
  apellido,
  telefono,
}) => ({
  email: normalizarEmail(email),
  password: String(password ?? ""),
  documento: normalizarDatoNumerico(documento),
  nombre: normalizarTexto(nombre),
  apellido: normalizarTexto(apellido),
  telefono: normalizarDatoNumerico(telefono),
});

// Normaliza únicamente los campos opcionales enviados para actualización.
const normalizarDatosActualizacionSocio = (datosSocio = {}) => {
  const datosNormalizados = {};

  if (datosSocio.email !== undefined) {
    datosNormalizados.email = normalizarEmail(datosSocio.email);
  }

  if (datosSocio.documento !== undefined) {
    datosNormalizados.documento = normalizarDatoNumerico(datosSocio.documento);
  }

  if (datosSocio.nombre !== undefined) {
    datosNormalizados.nombre = normalizarTexto(datosSocio.nombre);
  }

  if (datosSocio.apellido !== undefined) {
    datosNormalizados.apellido = normalizarTexto(datosSocio.apellido);
  }

  if (datosSocio.telefono !== undefined) {
    datosNormalizados.telefono = normalizarDatoNumerico(datosSocio.telefono);
  }

  return datosNormalizados;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Obtiene un socio existente con información segura de su usuario asociado.
const obtenerSocioPorId = async (socioId, tx = prisma) => {
  const socio = await tx.socio.findUnique({
    where: { id: socioId },
    select: socioSeguroSelect,
  });

  if (!socio) {
    throw new AppError("El socio indicado no existe", 404);
  }

  return socio;
};

// Obtiene el socio asociado al usuario autenticado.
const obtenerSocioPorUsuarioId = async (usuarioId, tx = prisma) => {
  const socio = await tx.socio.findUnique({
    where: { usuario_id: usuarioId },
    select: socioSeguroSelect,
  });

  if (!socio) {
    throw new AppError(
      "No existe un socio asociado al usuario autenticado",
      404,
    );
  }

  return socio;
};

// Verifica que no exista otro socio con el documento indicado.
const validarDocumentoDuplicadoSocio = async (
  documento,
  socioIdExcluir = null,
  tx = prisma,
) => {
  const socioExistente = await tx.socio.findUnique({
    where: { documento },
    select: { id: true },
  });

  if (socioExistente && socioExistente.id !== socioIdExcluir) {
    throw new AppError("Ya existe un socio con ese documento", 409);
  }
};

// Verifica que no exista otro usuario con el email indicado.
const validarEmailDuplicadoUsuario = async (
  email,
  usuarioIdExcluir = null,
  tx = prisma,
) => {
  const usuarioExistente = await tx.usuario.findUnique({
    where: { email },
    select: { id: true },
  });

  if (usuarioExistente && usuarioExistente.id !== usuarioIdExcluir) {
    throw new AppError("Ya existe un usuario con ese email", 409);
  }
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

// Valida todos los datos requeridos para registrar un socio.
const validarDatosCreacionSocio = ({
  email,
  password,
  documento,
  nombre,
  apellido,
  telefono,
}) => {
  if (!email || !password || !documento || !nombre || !apellido || !telefono) {
    throw new AppError(
      "Todos los campos obligatorios deben estar completos",
      400,
    );
  }

  if (!validarEmail(email)) {
    throw new AppError("El formato del email no es válido", 400);
  }

  if (!validarPassword(password)) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres", 400);
  }

  if (!validarDocumento(documento)) {
    throw new AppError("El documento ingresado no es válido", 400);
  }

  if (!validarTelefono(telefono)) {
    throw new AppError("El teléfono ingresado no es válido", 400);
  }

  if (!validarTexto(nombre) || !validarTexto(apellido)) {
    throw new AppError("El nombre o apellido ingresado no es válido", 400);
  }
};

// Valida únicamente los campos efectivamente enviados para actualización.
const validarDatosActualizacionSocio = (datosSocio) => {
  const camposRecibidos = Object.keys(datosSocio);

  if (camposRecibidos.length === 0) {
    throw new AppError(
      "Debe ingresar al menos un campo para actualizar el socio",
      400,
    );
  }

  if (datosSocio.email !== undefined) {
    if (!datosSocio.email || !validarEmail(datosSocio.email)) {
      throw new AppError("El formato del email no es válido", 400);
    }
  }

  if (datosSocio.documento !== undefined) {
    if (!datosSocio.documento || !validarDocumento(datosSocio.documento)) {
      throw new AppError("El documento ingresado no es válido", 400);
    }
  }

  if (datosSocio.telefono !== undefined) {
    if (!datosSocio.telefono || !validarTelefono(datosSocio.telefono)) {
      throw new AppError("El teléfono ingresado no es válido", 400);
    }
  }

  if (datosSocio.nombre !== undefined) {
    if (!datosSocio.nombre || !validarTexto(datosSocio.nombre)) {
      throw new AppError("El nombre ingresado no es válido", 400);
    }
  }

  if (datosSocio.apellido !== undefined) {
    if (!datosSocio.apellido || !validarTexto(datosSocio.apellido)) {
      throw new AppError("El apellido ingresado no es válido", 400);
    }
  }
};

// Evita registrar una transición hacia el mismo estado actual.
const validarCambioEstadoSocio = (socio, nuevoEstado) => {
  if (socio.estado === nuevoEstado) {
    throw new AppError(
      `El socio ya se encuentra en estado ${nuevoEstado}`,
      409,
    );
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

// Construye los filtros administrativos del listado de socios.
const construirFiltrosSocios = ({
  search = "",
  estado,
  estadoUsuario,
} = {}) => {
  const filtros = {};
  const searchNormalizado = String(search ?? "").trim();

  if (estado) {
    filtros.estado = validarEstadoSocio(estado);
  }

  if (estadoUsuario) {
    filtros.usuario = {
      is: {
        estado: validarEstadoUsuario(estadoUsuario),
      },
    };
  }

  if (searchNormalizado) {
    filtros.OR = [
      {
        nombre: {
          contains: searchNormalizado,
          mode: "insensitive",
        },
      },
      {
        apellido: {
          contains: searchNormalizado,
          mode: "insensitive",
        },
      },
      {
        documento: {
          contains: searchNormalizado,
        },
      },
      {
        telefono: {
          contains: searchNormalizado,
        },
      },
      {
        usuario: {
          is: {
            email: {
              contains: searchNormalizado,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return filtros;
};

/*
  Construye una respuesta paginada reutilizable.

  El contrato se mantiene alineado con los módulos administrativos Gold.
*/
const construirRespuestaPaginada = ({ data, total, page, limit }) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  },
});

/* =========================================================
   HELPERS DE TRANSFORMACIÓN
========================================================= */

// Determina los cambios reales enviados para Socio y Usuario.
const construirCambiosSocio = (socioExistente, datosNormalizados) => {
  const datosUsuario = {};
  const datosSocio = {};
  const camposModificados = [];

  if (
    datosNormalizados.email !== undefined &&
    datosNormalizados.email !== socioExistente.usuario.email
  ) {
    datosUsuario.email = datosNormalizados.email;
    camposModificados.push("email");
  }

  for (const campo of ["documento", "nombre", "apellido", "telefono"]) {
    if (
      datosNormalizados[campo] !== undefined &&
      datosNormalizados[campo] !== socioExistente[campo]
    ) {
      datosSocio[campo] = datosNormalizados[campo];
      camposModificados.push(campo);
    }
  }

  if (camposModificados.length === 0) {
    throw new AppError(
      "No se detectaron cambios para actualizar el socio",
      409,
    );
  }

  return {
    datosUsuario,
    datosSocio,
    camposModificados,
  };
};

/* =========================================================
   HELPERS DE AUDITORÍA
========================================================= */

// Registra la trazabilidad administrativa del alta de un socio.
const auditarCreacionSocio = async ({ usuarioId, socio }, tx) => {
  return registrarAuditoria(
    {
      usuarioId,
      accion: "CREAR_SOCIO",
      entidad: "Socio",
      entidadId: socio.id,
      detalle:
        `Se registró al socio ${socio.nombre} ${socio.apellido}. ` +
        `Documento: ${socio.documento}. Email: ${socio.usuario.email}.`,
    },
    tx,
  );
};

// Registra la trazabilidad administrativa de una actualización.
const auditarActualizacionSocio = async (
  { usuarioId, socio, camposModificados },
  tx,
) => {
  return registrarAuditoria(
    {
      usuarioId,
      accion: "ACTUALIZAR_SOCIO",
      entidad: "Socio",
      entidadId: socio.id,
      detalle:
        `Se actualizaron los datos del socio ${socio.nombre} ${socio.apellido}. ` +
        `Campos modificados: ${camposModificados.join(", ")}.`,
    },
    tx,
  );
};

// Registra la trazabilidad administrativa de un cambio de estado.
const auditarCambioEstadoSocio = async (
  {
    usuarioId,
    socio,
    estadoAnteriorSocio,
    nuevoEstadoSocio,
    estadoAnteriorUsuario,
    nuevoEstadoUsuario,
  },
  tx,
) => {
  return registrarAuditoria(
    {
      usuarioId,
      accion: "CAMBIAR_ESTADO_SOCIO",
      entidad: "Socio",
      entidadId: socio.id,
      detalle:
        `Se modificó el estado del socio ${socio.nombre} ${socio.apellido} ` +
        `de ${estadoAnteriorSocio} a ${nuevoEstadoSocio}. ` +
        `El estado de acceso del usuario cambió de ` +
        `${estadoAnteriorUsuario} a ${nuevoEstadoUsuario}.`,
    },
    tx,
  );
};

// Registra la aceptación del consentimiento por parte del propio socio.
const auditarAceptacionConsentimiento = async ({ usuarioId, socio }, tx) => {
  return registrarAuditoria(
    {
      usuarioId,
      accion: "ACEPTAR_CONSENTIMIENTO",
      entidad: "Socio",
      entidadId: socio.id,
      detalle:
        `El socio ${socio.nombre} ${socio.apellido} ` +
        "aceptó el consentimiento informado.",
    },
    tx,
  );
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta socios con búsqueda, filtros y paginación administrada por backend.
export const getSocios = async ({
  search,
  estado,
  estadoUsuario,
  page,
  limit,
} = {}) => {
  const where = construirFiltrosSocios({
    search,
    estado,
    estadoUsuario,
  });

  const paginacion = validarPaginacion({ page, limit });

  const [total, socios] = await prisma.$transaction([
    prisma.socio.count({ where }),
    prisma.socio.findMany({
      where,
      skip: paginacion.skip,
      take: paginacion.limit,
      select: socioSeguroSelect,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }, { id: "asc" }],
    }),
  ]);

  return construirRespuestaPaginada({
    data: socios,
    total,
    page: paginacion.page,
    limit: paginacion.limit,
  });
};

// Obtiene socios habilitados para ser seleccionados al registrar una venta.
export const getSociosOpcionesVenta = async () => {
  return prisma.socio.findMany({
    where: {
      estado: "ACTIVO",
      usuario: {
        is: {
          estado: "ACTIVO",
        },
      },
    },
    select: socioVentaOptionSelect,
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }, { id: "asc" }],
  });
};

// Consulta el detalle seguro de un socio para administración.
export const getSocioPorId = async (id) => {
  const socioId = validarIdSocio(id);

  return obtenerSocioPorId(socioId);
};

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra de forma atómica el Usuario, el Socio y su auditoría.
export const crearSocio = async ({
  usuarioId,
  email,
  password,
  documento,
  nombre,
  apellido,
  telefono,
}) => {
  const idUsuarioAdministrador = validarIdUsuario(usuarioId);

  const datosNormalizados = normalizarDatosCreacionSocio({
    email,
    password,
    documento,
    nombre,
    apellido,
    telefono,
  });

  validarDatosCreacionSocio(datosNormalizados);

  const passwordHash = await bcrypt.hash(datosNormalizados.password, 10);

  return prisma.$transaction(async (tx) => {
    await validarDocumentoDuplicadoSocio(datosNormalizados.documento, null, tx);

    await validarEmailDuplicadoUsuario(datosNormalizados.email, null, tx);

    const usuario = await tx.usuario.create({
      data: {
        email: datosNormalizados.email,
        password_hash: passwordHash,
        rol: "SOCIO",
      },
      select: usuarioSeguroSelect,
    });

    const socio = await tx.socio.create({
      data: {
        usuario_id: usuario.id,
        documento: datosNormalizados.documento,
        nombre: datosNormalizados.nombre,
        apellido: datosNormalizados.apellido,
        telefono: datosNormalizados.telefono,
        consentimiento_aceptado: false,
      },
      select: socioSeguroSelect,
    });

    await auditarCreacionSocio(
      {
        usuarioId: idUsuarioAdministrador,
        socio,
      },
      tx,
    );

    return socio;
  });
};

// Actualiza únicamente los campos enviados y registra la operación.
export const actualizarSocio = async ({ socioId, usuarioId, datosSocio }) => {
  const idSocio = validarIdSocio(socioId);
  const idUsuarioAdministrador = validarIdUsuario(usuarioId);

  const datosNormalizados = normalizarDatosActualizacionSocio(datosSocio);
  validarDatosActualizacionSocio(datosNormalizados);

  return prisma.$transaction(async (tx) => {
    const socioExistente = await obtenerSocioPorId(idSocio, tx);

    if (datosNormalizados.documento !== undefined) {
      await validarDocumentoDuplicadoSocio(
        datosNormalizados.documento,
        socioExistente.id,
        tx,
      );
    }

    if (datosNormalizados.email !== undefined) {
      await validarEmailDuplicadoUsuario(
        datosNormalizados.email,
        socioExistente.usuario.id,
        tx,
      );
    }

    const {
      datosUsuario,
      datosSocio: cambiosSocio,
      camposModificados,
    } = construirCambiosSocio(socioExistente, datosNormalizados);

    if (Object.keys(datosUsuario).length > 0) {
      await tx.usuario.update({
        where: { id: socioExistente.usuario_id },
        data: datosUsuario,
      });
    }

    if (Object.keys(cambiosSocio).length > 0) {
      await tx.socio.update({
        where: { id: idSocio },
        data: cambiosSocio,
      });
    }

    const socioActualizado = await obtenerSocioPorId(idSocio, tx);

    await auditarActualizacionSocio(
      {
        usuarioId: idUsuarioAdministrador,
        socio: socioActualizado,
        camposModificados,
      },
      tx,
    );

    return socioActualizado;
  });
};

// Sincroniza el estado funcional del Socio con el acceso de su Usuario.
export const cambiarEstadoSocio = async ({
  socioId,
  usuarioId,
  nuevoEstado,
}) => {
  const idSocio = validarIdSocio(socioId);
  const idUsuarioAdministrador = validarIdUsuario(usuarioId);
  const estadoSocioValidado = validarEstadoSocio(nuevoEstado);

  return prisma.$transaction(async (tx) => {
    const socioExistente = await obtenerSocioPorId(idSocio, tx);

    validarCambioEstadoSocio(socioExistente, estadoSocioValidado);

    const nuevoEstadoUsuario =
      ESTADO_USUARIO_POR_ESTADO_SOCIO[estadoSocioValidado];

    await tx.usuario.update({
      where: { id: socioExistente.usuario_id },
      data: {
        estado: nuevoEstadoUsuario,
      },
    });

    await tx.socio.update({
      where: { id: idSocio },
      data: {
        estado: estadoSocioValidado,
      },
    });

    const socioActualizado = await obtenerSocioPorId(idSocio, tx);

    await auditarCambioEstadoSocio(
      {
        usuarioId: idUsuarioAdministrador,
        socio: socioActualizado,
        estadoAnteriorSocio: socioExistente.estado,
        nuevoEstadoSocio: estadoSocioValidado,
        estadoAnteriorUsuario: socioExistente.usuario.estado,
        nuevoEstadoUsuario,
      },
      tx,
    );

    return socioActualizado;
  });
};

/* =========================================================
   PERFIL Y CONSENTIMIENTO
========================================================= */

// Consulta el perfil del socio autenticado sin exponer datos sensibles.
export const obtenerPerfilSocio = async (usuarioId) => {
  const idUsuario = validarIdUsuario(usuarioId);

  return obtenerSocioPorUsuarioId(idUsuario);
};

// Registra de forma atómica la aceptación del consentimiento
// y la auditoría asociada al propio socio autenticado.
export const aceptarConsentimiento = async (usuarioId) => {
  const idUsuario = validarIdUsuario(usuarioId);

  return prisma.$transaction(async (tx) => {
    const socio = await obtenerSocioPorUsuarioId(idUsuario, tx);

    if (socio.consentimiento_aceptado) {
      throw new AppError("El consentimiento ya fue aceptado", 409);
    }

    const socioActualizado = await tx.socio.update({
      where: { id: socio.id },
      data: {
        consentimiento_aceptado: true,
        fecha_consentimiento: new Date(),
      },
      select: socioSeguroSelect,
    });

    await auditarAceptacionConsentimiento(
      {
        usuarioId: idUsuario,
        socio: socioActualizado,
      },
      tx,
    );

    return socioActualizado;
  });
};
