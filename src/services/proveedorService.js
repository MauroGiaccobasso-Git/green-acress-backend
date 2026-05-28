import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { validarEmail, validarTelefono } from "../utils/validaciones.js";

export const obtenerProveedores = async (search) => {
  // Si existe search, arma un filtro dinámico por campos principales.
  const where = search
    ? {
        OR: [
          {
            nombre: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            contacto: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            telefono: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }
    : {};

  return prisma.proveedor.findMany({
    where,
    orderBy: [
      {
        nombre: "asc",
      },
      {
        contacto: "asc",
      },
      {
        id: "asc",
      },
    ],
  });
};

// Valida un campo obligatorio reutilizando un mensaje específico.
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
  // Valida los datos mínimos requeridos para registrar o actualizar proveedor.
  validarCampoObligatorio(nombre, "El nombre del proveedor es obligatorio");
  validarCampoObligatorio(contacto, "El contacto del proveedor es obligatorio");
  validarCampoObligatorio(telefono, "El teléfono del proveedor es obligatorio");
  validarCampoObligatorio(email, "El email del proveedor es obligatorio");
};

const validarFormatoProveedor = ({ telefono, email }) => {
  // Reutiliza validaciones genéricas centralizadas en utils.
  if (!validarTelefono(telefono)) {
    throw new AppError(
      "El teléfono del proveedor no tiene un formato válido",
      400,
    );
  }

  if (!validarEmail(email)) {
    throw new AppError(
      "El email del proveedor no tiene un formato válido",
      400,
    );
  }
};

const validarProveedorDuplicado = async (
  { nombre, email },
  proveedorId = null,
) => {
  // Busca proveedores existentes con el mismo nombre o email.
  const where = {
    OR: [
      { nombre: { equals: nombre, mode: "insensitive" } },
      { email: { equals: email, mode: "insensitive" } },
    ],
  };

  // En actualización se excluye el proveedor actual para no compararlo consigo mismo.
  if (proveedorId) {
    where.NOT = {
      id: proveedorId,
    };
  }

  const proveedorExistente = await prisma.proveedor.findFirst({
    where,
  });

  if (proveedorExistente) {
    throw new AppError(
      "Ya existe un proveedor registrado con ese nombre o email",
      409,
    );
  }
};

// Normaliza los datos del proveedor antes de persistir para evitar espacios inválidos.
const construirDatosProveedor = ({ nombre, contacto, telefono, email }) => ({
  nombre: nombre.trim(),
  contacto: contacto.trim(),
  telefono: telefono.trim(),
  email: email.trim(),
});

export const crearProveedor = async (datosProveedor) => {
  // Orquesta validaciones y persistencia sin mezclar responsabilidades.
  validarDatosObligatoriosProveedor(datosProveedor);
  validarFormatoProveedor(datosProveedor);
  await validarProveedorDuplicado(datosProveedor);

  const datosNormalizados = construirDatosProveedor(datosProveedor);

  return prisma.proveedor.create({
    data: datosNormalizados,
  });
};

// Convierte y valida el identificador recibido por parámetro.
const validarIdProveedor = (id) => {
  const proveedorId = Number(id);

  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    throw new AppError("El id del proveedor es inválido", 400);
  }

  return proveedorId;
};

// Obtiene un proveedor existente o corta el flujo con error controlado.
const obtenerProveedorPorId = async (proveedorId) => {
  const proveedor = await prisma.proveedor.findUnique({
    where: {
      id: proveedorId,
    },
  });

  if (!proveedor) {
    throw new AppError("El proveedor indicado no existe", 404);
  }

  return proveedor;
};

export const actualizarProveedor = async (id, datosProveedor) => {
  const proveedorId = validarIdProveedor(id);

  await obtenerProveedorPorId(proveedorId);

  validarDatosObligatoriosProveedor(datosProveedor);
  validarFormatoProveedor(datosProveedor);
  await validarProveedorDuplicado(datosProveedor, proveedorId);

  const datosNormalizados = construirDatosProveedor(datosProveedor);

  return prisma.proveedor.update({
    where: {
      id: proveedorId,
    },
    data: datosNormalizados,
  });
};

// Valida que el estado enviado pertenezca a los estados permitidos.
const validarEstadoProveedor = (estado) => {
  const estadosPermitidos = ["ACTIVO", "INACTIVO"];

  if (!estadosPermitidos.includes(estado)) {
    throw new AppError("El estado del proveedor no es válido", 400);
  }
};

// Evita ejecutar actualizaciones innecesarias si el estado no cambia.
const validarCambioEstadoProveedor = (estadoActual, nuevoEstado) => {
  if (estadoActual === nuevoEstado) {
    throw new AppError(
      "El proveedor ya se encuentra en el estado indicado",
      400,
    );
  }
};

export const actualizarEstadoProveedor = async (id, nuevoEstado) => {
  const proveedorId = validarIdProveedor(id);

  validarEstadoProveedor(nuevoEstado);

  const proveedor = await obtenerProveedorPorId(proveedorId);

  validarCambioEstadoProveedor(proveedor.estado, nuevoEstado);

  return prisma.proveedor.update({
    where: {
      id: proveedorId,
    },
    data: {
      estado: nuevoEstado,
    },
  });
};