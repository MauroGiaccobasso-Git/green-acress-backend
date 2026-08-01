import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { validarEmail, validarTelefono } from "../utils/validaciones.js";
import { registrarAuditoria } from "./auditoriaService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const ESTADOS_PROVEEDOR_VALIDOS = ["ACTIVO", "INACTIVO"];

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador del proveedor.
const validarIdProveedor = (id) => {
  const proveedorId = Number(id);

  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    throw new AppError("El id del proveedor es inválido", 400);
  }

  return proveedorId;
};

// Convierte y valida el identificador del administrador responsable.
const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario administrador es obligatorio", 400);
  }

  return usuarioId;
};

// Valida un estado permitido y devuelve su representación normalizada.
const validarEstadoProveedor = (estado) => {
  const estadoNormalizado = String(estado ?? "")
    .trim()
    .toUpperCase();

  if (!ESTADOS_PROVEEDOR_VALIDOS.includes(estadoNormalizado)) {
    throw new AppError("El estado del proveedor no es válido", 400);
  }

  return estadoNormalizado;
};

/* =========================================================
   HELPERS DE NORMALIZACIÓN
========================================================= */

// Normaliza textos generales sin modificar las mayúsculas elegidas.
const normalizarTexto = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim().replace(/\s+/g, " ");
};

// Normaliza el email para evitar diferencias por espacios o mayúsculas.
const normalizarEmail = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim().toLowerCase();
};

// Normaliza el teléfono almacenado como texto.
const normalizarTelefono = (valor) => {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim();
};

// Normaliza los datos obligatorios utilizados para crear o editar proveedores.
const normalizarDatosProveedor = ({
  nombre,
  contacto,
  telefono,
  email,
} = {}) => ({
  nombre: normalizarTexto(nombre),
  contacto: normalizarTexto(contacto),
  telefono: normalizarTelefono(telefono),
  email: normalizarEmail(email),
});

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Obtiene un proveedor existente o informa que no fue encontrado.
const obtenerProveedorPorId = async (proveedorId, tx = prisma) => {
  const proveedor = await tx.proveedor.findUnique({
    where: { id: proveedorId },
  });

  if (!proveedor) {
    throw new AppError("El proveedor indicado no existe", 404);
  }

  return proveedor;
};

/* =========================================================
   VALIDACIONES DE DATOS Y NEGOCIO
========================================================= */

// Verifica la presencia de todos los datos requeridos por el proveedor.
const validarDatosObligatoriosProveedor = ({
  nombre,
  contacto,
  telefono,
  email,
}) => {
  if (!nombre) {
    throw new AppError("El nombre del proveedor es obligatorio", 400);
  }

  if (!contacto) {
    throw new AppError("El contacto del proveedor es obligatorio", 400);
  }

  if (!telefono) {
    throw new AppError("El teléfono del proveedor es obligatorio", 400);
  }

  if (!email) {
    throw new AppError("El email del proveedor es obligatorio", 400);
  }
};

// Valida los formatos compartidos de teléfono y correo electrónico.
const validarFormatoProveedor = ({ telefono, email }) => {
  if (!validarTelefono(telefono)) {
    throw new AppError("El teléfono del proveedor no es válido", 400);
  }

  if (!validarEmail(email)) {
    throw new AppError("El email del proveedor no es válido", 400);
  }
};

// Impide duplicados por nombre o correo electrónico.
const validarProveedorDuplicado = async (
  { nombre, email, proveedorId = null },
  tx = prisma,
) => {
  const proveedorDuplicado = await tx.proveedor.findFirst({
    where: {
      OR: [
        {
          nombre: {
            equals: nombre,
            mode: "insensitive",
          },
        },
        {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
      ],
      NOT: proveedorId ? { id: proveedorId } : undefined,
    },
  });

  if (proveedorDuplicado) {
    throw new AppError(
      "Ya existe otro proveedor con ese nombre o email",
      409,
    );
  }
};

// Evita actualizaciones que no modifican ningún dato del proveedor.
const construirCambiosProveedor = (proveedorExistente, datosNormalizados) => {
  const cambios = {};
  const camposModificados = [];

  for (const campo of ["nombre", "contacto", "telefono", "email"]) {
    if (datosNormalizados[campo] !== proveedorExistente[campo]) {
      cambios[campo] = datosNormalizados[campo];
      camposModificados.push(campo);
    }
  }

  if (camposModificados.length === 0) {
    throw new AppError(
      "No se detectaron cambios para actualizar el proveedor",
      409,
    );
  }

  return {
    cambios,
    camposModificados,
  };
};

// Impide cambios redundantes de estado.
const validarCambioEstadoProveedor = (estadoActual, nuevoEstado) => {
  if (estadoActual === nuevoEstado) {
    throw new AppError(
      `El proveedor ya se encuentra ${nuevoEstado.toLowerCase()}`,
      400,
    );
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

// Construye la búsqueda administrativa y el filtro exacto por estado.
const construirWhereProveedores = ({ search = "", estado } = {}) => {
  const filtros = [];
  const searchNormalizado = String(search ?? "").trim();

  if (searchNormalizado) {
    filtros.push({
      OR: [
        {
          nombre: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
        {
          contacto: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (estado !== undefined && estado !== null && String(estado).trim()) {
    filtros.push({
      estado: validarEstadoProveedor(estado),
    });
  }

  return filtros.length > 0 ? { AND: filtros } : undefined;
};

/* =========================================================
   HELPERS DE AUDITORÍA
========================================================= */

// Registra la trazabilidad administrativa del alta de un proveedor.
const auditarCreacionProveedor = async ({ usuarioId, proveedor }, tx) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CREAR_PROVEEDOR",
      entidad: "Proveedor",
      entidadId: proveedor.id,
      detalle: `Proveedor ${proveedor.nombre} creado en estado ${proveedor.estado}.`,
    },
    tx,
  );
};

// Registra la trazabilidad administrativa de una modificación.
const auditarActualizacionProveedor = async (
  { usuarioId, proveedor, camposModificados },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "ACTUALIZAR_PROVEEDOR",
      entidad: "Proveedor",
      entidadId: proveedor.id,
      detalle:
        `Proveedor ${proveedor.nombre} actualizado. ` +
        `Campos modificados: ${camposModificados.join(", ")}.`,
    },
    tx,
  );
};

// Registra la trazabilidad administrativa de un cambio de estado.
const auditarCambioEstadoProveedor = async (
  { usuarioId, proveedor, estadoAnterior },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CAMBIAR_ESTADO_PROVEEDOR",
      entidad: "Proveedor",
      entidadId: proveedor.id,
      detalle: `Proveedor ${proveedor.nombre} cambió de ${estadoAnterior} a ${proveedor.estado}.`,
    },
    tx,
  );
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const obtenerProveedores = async ({ search = "", estado } = {}) => {
  const where = construirWhereProveedores({ search, estado });

  return prisma.proveedor.findMany({
    where,
    orderBy: [{ nombre: "asc" }, { contacto: "asc" }, { id: "asc" }],
  });
};

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

export const crearProveedor = async ({ datosProveedor, usuarioId }) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const datosNormalizados = normalizarDatosProveedor(datosProveedor);

  validarDatosObligatoriosProveedor(datosNormalizados);
  validarFormatoProveedor(datosNormalizados);

  return prisma.$transaction(async (tx) => {
    await validarProveedorDuplicado(
      {
        nombre: datosNormalizados.nombre,
        email: datosNormalizados.email,
      },
      tx,
    );

    const proveedor = await tx.proveedor.create({
      data: {
        ...datosNormalizados,
        estado: "ACTIVO",
      },
    });

    await auditarCreacionProveedor(
      {
        usuarioId: idUsuario,
        proveedor,
      },
      tx,
    );

    return proveedor;
  });
};

export const actualizarProveedor = async ({
  proveedorId,
  datosProveedor,
  usuarioId,
}) => {
  const idProveedor = validarIdProveedor(proveedorId);
  const idUsuario = validarIdUsuario(usuarioId);
  const datosNormalizados = normalizarDatosProveedor(datosProveedor);

  validarDatosObligatoriosProveedor(datosNormalizados);
  validarFormatoProveedor(datosNormalizados);

  return prisma.$transaction(async (tx) => {
    const proveedorExistente = await obtenerProveedorPorId(idProveedor, tx);

    await validarProveedorDuplicado(
      {
        nombre: datosNormalizados.nombre,
        email: datosNormalizados.email,
        proveedorId: idProveedor,
      },
      tx,
    );

    const { cambios, camposModificados } = construirCambiosProveedor(
      proveedorExistente,
      datosNormalizados,
    );

    const proveedor = await tx.proveedor.update({
      where: { id: idProveedor },
      data: cambios,
    });

    await auditarActualizacionProveedor(
      {
        usuarioId: idUsuario,
        proveedor,
        camposModificados,
      },
      tx,
    );

    return proveedor;
  });
};

/* =========================================================
   CAMBIO DE ESTADO
========================================================= */

export const actualizarEstadoProveedor = async ({
  proveedorId,
  nuevoEstado,
  usuarioId,
}) => {
  const idProveedor = validarIdProveedor(proveedorId);
  const idUsuario = validarIdUsuario(usuarioId);
  const estadoValidado = validarEstadoProveedor(nuevoEstado);

  return prisma.$transaction(async (tx) => {
    const proveedorExistente = await obtenerProveedorPorId(idProveedor, tx);

    validarCambioEstadoProveedor(proveedorExistente.estado, estadoValidado);

    const proveedor = await tx.proveedor.update({
      where: { id: idProveedor },
      data: { estado: estadoValidado },
    });

    await auditarCambioEstadoProveedor(
      {
        usuarioId: idUsuario,
        proveedor,
        estadoAnterior: proveedorExistente.estado,
      },
      tx,
    );

    return proveedor;
  });
};  