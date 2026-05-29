import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { AppError } from "../utils/appError.js";
import {
  validarEmail,
  validarPassword,
  validarDocumento,
  validarTelefono,
  validarTexto,
  validarEstado,
} from "../utils/validaciones.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador recibido por parámetro.
const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Obtiene un socio existente junto con su usuario asociado.
const obtenerSocioPorId = async (socioId) => {
  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { usuario: true },
  });

  if (!socio) {
    throw new AppError("El socio indicado no existe", 404);
  }

  return socio;
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

// Valida datos obligatorios para creación de socio.
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

// Valida datos opcionales en actualización.
const validarDatosActualizacionSocio = ({
  email,
  documento,
  nombre,
  apellido,
  telefono,
}) => {
  if (email && !validarEmail(email)) {
    throw new AppError("El formato del email no es válido", 400);
  }

  if (documento && !validarDocumento(documento)) {
    throw new AppError("El documento ingresado no es válido", 400);
  }

  if (telefono && !validarTelefono(telefono)) {
    throw new AppError("El teléfono ingresado no es válido", 400);
  }

  if (
    (nombre && !validarTexto(nombre)) ||
    (apellido && !validarTexto(apellido))
  ) {
    throw new AppError("El nombre o apellido ingresado no es válido", 400);
  }
};

// Evita duplicación de documento.
const validarDocumentoDuplicadoSocio = async (documento, socioExistente) => {
  if (!documento || documento === socioExistente.documento) return;

  const existe = await prisma.socio.findUnique({
    where: { documento },
  });

  if (existe) {
    throw new AppError("Ya existe un socio con ese documento", 409);
  }
};

// Evita duplicación de email.
const validarEmailDuplicadoUsuario = async (email, socioExistente) => {
  if (!email || email === socioExistente.usuario.email) return;

  const existe = await prisma.usuario.findUnique({
    where: { email },
  });

  if (existe) {
    throw new AppError("Ya existe un usuario con ese email", 409);
  }
};

/* =========================================================
   CRUD PRINCIPAL
========================================================= */

export const getSocios = async (search = "") => {
  const searchNormalizado = search.trim();
  const searchEnum = searchNormalizado.toUpperCase();

  const filtros = searchNormalizado
    ? [
        { nombre: { contains: searchNormalizado, mode: "insensitive" } },
        { apellido: { contains: searchNormalizado, mode: "insensitive" } },
        { documento: { contains: searchNormalizado } },
        { telefono: { contains: searchNormalizado } },
        {
          usuario: {
            email: { contains: searchNormalizado, mode: "insensitive" },
          },
        },
      ]
    : [];

  if (["ACTIVO", "INACTIVO", "SUSPENDIDO"].includes(searchEnum)) {
    filtros.push({ estado: { equals: searchEnum } });
  }

  return prisma.socio.findMany({
    where: filtros.length ? { OR: filtros } : undefined,
    include: {
      usuario: {
        select: {
          id: true,
          email: true,
          rol: true,
          estado: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });
};

export const crearSocio = async (datosSocio) => {
  validarDatosCreacionSocio(datosSocio);

  const { email, password, documento, nombre, apellido, telefono } = datosSocio;

  const socioExistente = await prisma.socio.findUnique({
    where: { documento },
  });

  if (socioExistente) {
    throw new AppError("Ya existe un socio con ese documento", 409);
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email },
  });

  if (usuarioExistente) {
    throw new AppError("Ya existe un usuario con ese email", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email,
        password_hash: passwordHash,
        rol: "SOCIO",
      },
    });

    return tx.socio.create({
      data: {
        usuario_id: usuario.id,
        documento,
        nombre,
        apellido,
        telefono,
        consentimiento_aceptado: false,
      },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            rol: true,
            estado: true,
          },
        },
      },
    });
  });
};

export const actualizarSocio = async (id, datosSocio) => {
  const socioId = validarIdSocio(id);

  validarDatosActualizacionSocio(datosSocio);

  const socioExistente = await obtenerSocioPorId(socioId);

  const { email, documento, nombre, apellido, telefono } = datosSocio;

  await validarDocumentoDuplicadoSocio(documento, socioExistente);
  await validarEmailDuplicadoUsuario(email, socioExistente);

  return prisma.$transaction(async (tx) => {
    if (email) {
      await tx.usuario.update({
        where: { id: socioExistente.usuario_id },
        data: { email },
      });
    }

    return tx.socio.update({
      where: { id: socioId },
      data: {
        documento,
        nombre,
        apellido,
        telefono,
        fecha_actualizacion: new Date(),
      },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            rol: true,
            estado: true,
          },
        },
      },
    });
  });
};

export const cambiarEstadoSocio = async (id, nuevoEstado) => {
  const socioId = validarIdSocio(id);

  if (!validarEstado(nuevoEstado)) {
    throw new AppError("El estado ingresado no es válido", 400);
  }

  const socio = await obtenerSocioPorId(socioId);

  let estadoUsuario;

  if (nuevoEstado === "ACTIVO") estadoUsuario = "ACTIVO";
  if (nuevoEstado === "INACTIVO") estadoUsuario = "INACTIVO";
  if (nuevoEstado === "SUSPENDIDO") estadoUsuario = "BLOQUEADO";

  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: socio.usuario_id },
      data: {
        estado: estadoUsuario,
        fecha_actualizacion: new Date(),
      },
    });

    return tx.socio.update({
      where: { id: socioId },
      data: {
        estado: nuevoEstado,
        fecha_actualizacion: new Date(),
      },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            rol: true,
            estado: true,
          },
        },
      },
    });
  });
};

/* =========================================================
   PERFIL Y CONSENTIMIENTO
========================================================= */

export const obtenerPerfilSocio = async (usuarioId) => {
  const socio = await prisma.socio.findUnique({
    where: { usuario_id: usuarioId },
    select: {
      id: true,
      documento: true,
      nombre: true,
      apellido: true,
      telefono: true,
      estado: true,
      fecha_alta: true,
      consentimiento_aceptado: true,
      fecha_consentimiento: true,
      usuario: {
        select: {
          id: true,
          email: true,
          rol: true,
          estado: true,
        },
      },
    },
  });

  if (!socio) {
    throw new AppError(
      "No existe un socio asociado al usuario autenticado",
      404,
    );
  }

  return socio;
};

export const aceptarConsentimiento = async (usuarioId) => {
  const socio = await prisma.socio.findUnique({
    where: { usuario_id: usuarioId },
  });

  if (!socio) {
    throw new AppError(
      "No existe un socio asociado al usuario autenticado",
      404,
    );
  }

  if (socio.consentimiento_aceptado) {
    throw new AppError("El consentimiento ya fue aceptado", 409);
  }

  return prisma.socio.update({
    where: { id: socio.id },
    data: {
      consentimiento_aceptado: true,
      fecha_consentimiento: new Date(),
      fecha_actualizacion: new Date(),
    },
  });
};
