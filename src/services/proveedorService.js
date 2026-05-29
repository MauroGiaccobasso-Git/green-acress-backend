import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { validarEmail, validarTelefono } from "../utils/validaciones.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida ID de proveedor.
const validarIdProveedor = (id) => {
  const proveedorId = Number(id);

  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    throw new AppError("El id del proveedor es inválido", 400);
  }

  return proveedorId;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Obtiene proveedor o lanza error si no existe.
const obtenerProveedorPorId = async (proveedorId) => {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
  });

  if (!proveedor) {
    throw new AppError("El proveedor indicado no existe", 404);
  }

  return proveedor;
};

/* =========================================================
   VALIDACIONES DE CAMPOS
========================================================= */

// Valida campos obligatorios.
const validarCampoObligatorio = (valor, mensaje) => {
  if (!valor || valor.trim() === "") {
    throw new AppError(mensaje, 400);
  }
};

const validarDatosObligatoriosProveedor = ({
  nombre,
  contacto,
  telefono,
  email,
}) => {
  validarCampoObligatorio(nombre, "El nombre del proveedor es obligatorio");
  validarCampoObligatorio(contacto, "El contacto del proveedor es obligatorio");
  validarCampoObligatorio(telefono, "El teléfono del proveedor es obligatorio");
  validarCampoObligatorio(email, "El email del proveedor es obligatorio");
};

// Valida formato email/teléfono.
const validarFormatoProveedor = ({ telefono, email }) => {
  if (!validarTelefono(telefono)) {
    throw new AppError("El teléfono no es válido", 400);
  }

  if (!validarEmail(email)) {
    throw new AppError("El email no es válido", 400);
  }
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

// Evita duplicados de nombre o email.
const validarProveedorDuplicado = async (
  { nombre, email },
  proveedorId = null,
) => {
  const where = {
    OR: [
      { nombre: { equals: nombre, mode: "insensitive" } },
      { email: { equals: email, mode: "insensitive" } },
    ],
  };

  if (proveedorId) {
    where.NOT = { id: proveedorId };
  }

  const existe = await prisma.proveedor.findFirst({ where });

  if (existe) {
    throw new AppError("Ya existe un proveedor con ese nombre o email", 409);
  }
};

// Valida estado permitido.
const validarEstadoProveedor = (estado) => {
  const estadosPermitidos = ["ACTIVO", "INACTIVO"];

  if (!estadosPermitidos.includes(estado)) {
    throw new AppError("El estado del proveedor no es válido", 400);
  }
};

// Evita updates redundantes de estado.
const validarCambioEstadoProveedor = (estadoActual, nuevoEstado) => {
  if (estadoActual === nuevoEstado) {
    throw new AppError("El proveedor ya se encuentra en ese estado", 400);
  }
};

/* =========================================================
   TRANSFORMACIÓN DE DATOS
========================================================= */

// Normaliza datos antes de persistir.
const construirDatosProveedor = ({ nombre, contacto, telefono, email }) => ({
  nombre: nombre.trim(),
  contacto: contacto.trim(),
  telefono: telefono.trim(),
  email: email.trim(),
});

/* =========================================================
   CRUD PRINCIPAL
========================================================= */

export const obtenerProveedores = async (search = "") => {
  const searchNormalizado = search.trim();

  const where = searchNormalizado
    ? {
        OR: [
          { nombre: { contains: searchNormalizado, mode: "insensitive" } },
          { contacto: { contains: searchNormalizado, mode: "insensitive" } },
          { telefono: { contains: searchNormalizado, mode: "insensitive" } },
          { email: { contains: searchNormalizado, mode: "insensitive" } },
        ],
      }
    : {};

  return prisma.proveedor.findMany({
    where,
    orderBy: [{ nombre: "asc" }, { contacto: "asc" }, { id: "asc" }],
  });
};

export const crearProveedor = async (datosProveedor) => {
  validarDatosObligatoriosProveedor(datosProveedor);
  validarFormatoProveedor(datosProveedor);
  await validarProveedorDuplicado(datosProveedor);

  const data = construirDatosProveedor(datosProveedor);

  return prisma.proveedor.create({ data });
};

export const actualizarProveedor = async (id, datosProveedor) => {
  const proveedorId = validarIdProveedor(id);

  await obtenerProveedorPorId(proveedorId);

  validarDatosObligatoriosProveedor(datosProveedor);
  validarFormatoProveedor(datosProveedor);
  await validarProveedorDuplicado(datosProveedor, proveedorId);

  const data = construirDatosProveedor(datosProveedor);

  return prisma.proveedor.update({
    where: { id: proveedorId },
    data,
  });
};

/* =========================================================
   CAMBIO DE ESTADO
========================================================= */

export const actualizarEstadoProveedor = async (id, nuevoEstado) => {
  const proveedorId = validarIdProveedor(id);

  validarEstadoProveedor(nuevoEstado);

  const proveedor = await obtenerProveedorPorId(proveedorId);

  validarCambioEstadoProveedor(proveedor.estado, nuevoEstado);

  return prisma.proveedor.update({
    where: { id: proveedorId },
    data: { estado: nuevoEstado },
  });
};
