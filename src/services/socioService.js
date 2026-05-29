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
// Servicio encargado de obtener todos los socios registrados en el sistema
// Esta función concentra la lógica de acceso a datos del módulo de socios
// Servicio encargado de obtener socios registrados en el sistema.
// Permite aplicar una búsqueda opcional para facilitar la gestión administrativa.
export const obtenerSocios = async (search = "") => {
  const searchNormalizado = search.trim();
  const searchEnum = searchNormalizado.toUpperCase();

  const filtros = searchNormalizado
    ? [
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
            email: {
              contains: searchNormalizado,
              mode: "insensitive",
            },
          },
        },
      ]
    : [];

  if (["ACTIVO", "INACTIVO", "SUSPENDIDO"].includes(searchEnum)) {
    filtros.push({
      estado: {
        equals: searchEnum,
      },
    });
  }

  const socios = await prisma.socio.findMany({
    where: filtros.length > 0 ? { OR: filtros } : undefined,

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

    orderBy: {
      id: "asc",
    },
  });

  return socios;
};

// Valida los datos obligatorios y formatos necesarios para registrar un socio.
// Reutiliza las validaciones generales del sistema.
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

// Servicio encargado de registrar un nuevo socio junto con su usuario asociado
// Esta función crea primero el Usuario con rol SOCIO y luego el Socio vinculado
export const crearSocio = async (datosSocio) => {
  validarDatosCreacionSocio(datosSocio);
  const { email, password, documento, nombre, apellido, telefono } = datosSocio;

  // Valida si ya existe un socio con el mismo documento
  // Esto evita duplicar socios dentro del sistema
  const socioExistente = await prisma.socio.findUnique({
    where: {
      documento,
    },
  });

  if (socioExistente) {
    throw new AppError("Ya existe un socio registrado con ese documento", 409);
  }

  // Valida si ya existe un usuario con el mismo email
  // El email debe ser único porque se usa para iniciar sesión
  const usuarioExistente = await prisma.usuario.findUnique({
    where: {
      email,
    },
  });

  if (usuarioExistente) {
    throw new AppError("Ya existe un usuario registrado con ese email", 409);
  }

  // Genera un hash seguro de la contraseña antes de guardarla
  // Nunca se almacena la contraseña en texto plano
  const passwordHash = await bcrypt.hash(password, 10);

  // Ejecuta la creación de usuario y socio dentro de una transacción
  // Si falla una operación, se revierte todo y no quedan datos inconsistentes
  const nuevoSocio = await prisma.$transaction(async (tx) => {
    // Crea primero el usuario asociado al socio
    const nuevoUsuario = await tx.usuario.create({
      data: {
        email,
        password_hash: passwordHash,
        rol: "SOCIO",
      },
    });

    // Crea el socio vinculado al usuario recién generado.
    // El consentimiento queda pendiente hasta que el socio
    // acepte los términos desde su propio acceso al sistema.
    const socioCreado = await tx.socio.create({
      data: {
        usuario_id: nuevoUsuario.id,
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

    // Devuelve el socio creado con los datos básicos del usuario asociado
    return socioCreado;
  });

  // Retorna el resultado final al controlador
  return nuevoSocio;
};

// Convierte y valida el identificador recibido por parámetro.
// Evita consultar la base de datos con ids inválidos.
const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

// Obtiene un socio existente junto con su usuario asociado.
// Centraliza la validación de existencia.
const obtenerSocioPorId = async (socioId) => {
  const socio = await prisma.socio.findUnique({
    where: {
      id: socioId,
    },
    include: {
      usuario: true,
    },
  });

  if (!socio) {
    throw new AppError("El socio indicado no existe", 404);
  }

  return socio;
};

// Valida únicamente los campos enviados durante una actualización.
// Permite modificaciones parciales manteniendo reglas de negocio.
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

// Valida que no exista otro socio con el mismo documento.
const validarDocumentoDuplicadoSocio = async (documento, socioExistente) => {
  if (!documento || documento === socioExistente.documento) {
    return;
  }

  const documentoExistente = await prisma.socio.findUnique({
    where: { documento },
  });

  if (documentoExistente) {
    throw new AppError("Ya existe un socio registrado con ese documento", 409);
  }
};

// Valida que no exista otro usuario con el mismo email.
const validarEmailDuplicadoUsuario = async (email, socioExistente) => {
  if (!email || email === socioExistente.usuario.email) {
    return;
  }

  const emailExistente = await prisma.usuario.findUnique({
    where: { email },
  });

  if (emailExistente) {
    throw new AppError("Ya existe un usuario registrado con ese email", 409);
  }
};

// Servicio encargado de actualizar los datos de un socio existente.
// Permite modificar información del socio y del usuario asociado.
export const actualizarSocio = async (id, datosSocio) => {
  // Valida el identificador antes de consultar o actualizar el socio.
  const socioId = validarIdSocio(id);

  // Extrae datos utilizados durante validaciones y actualización.
  const { email, documento, nombre, apellido, telefono } = datosSocio;

  validarDatosActualizacionSocio(datosSocio);

  const socioExistente = await obtenerSocioPorId(socioId);

  await validarDocumentoDuplicadoSocio(documento, socioExistente);
  await validarEmailDuplicadoUsuario(email, socioExistente);

  // Ejecuta la actualización dentro de una transacción para mantener consistencia Usuario/Socio.
  const socioActualizado = await prisma.$transaction(async (tx) => {
    if (email) {
      await tx.usuario.update({
        where: { id: socioExistente.usuario_id },
        data: { email },
      });
    }

    return await tx.socio.update({
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

  return socioActualizado;
};

// Servicio encargado de centralizar la lógica de cambio
// de estado de socios dentro del sistema.
//
// Esta función permite manejar desde un único punto:
// - activación;
// - desactivación;
// - suspensión.
//
// Además sincroniza automáticamente el estado
// del usuario asociado según las reglas del negocio.
export const cambiarEstadoSocio = async (id, nuevoEstado) => {
  // Valida el identificador antes de cambiar el estado del socio.
  const socioId = validarIdSocio(id);

  if (!validarEstado(nuevoEstado)) {
    throw new AppError("El estado ingresado no es válido", 400);
  }

  const socioExistente = await obtenerSocioPorId(socioId);

  // Resuelve el estado del usuario asociado según el estado del socio.
  let estadoUsuario;

  if (nuevoEstado === "ACTIVO") {
    estadoUsuario = "ACTIVO";
  }

  if (nuevoEstado === "INACTIVO") {
    estadoUsuario = "INACTIVO";
  }

  if (nuevoEstado === "SUSPENDIDO") {
    estadoUsuario = "BLOQUEADO";
  }

  // Ejecuta la operación dentro de una transacción para mantener consistencia Usuario/Socio.
  const socioActualizado = await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: socioExistente.usuario_id },
      data: {
        estado: estadoUsuario,
        fecha_actualizacion: new Date(),
      },
    });

    return await tx.socio.update({
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

  return socioActualizado;
};

// Servicio encargado de obtener el perfil del socio autenticado.
// Utiliza el usuario_id recibido desde el token JWT para buscar el socio asociado.
export const obtenerPerfilSocio = async (usuarioId) => {
  // Busca el socio vinculado al usuario autenticado.
  const socio = await prisma.socio.findUnique({
    where: {
      usuario_id: usuarioId,
    },
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

  // Si no existe un socio asociado al usuario,
  // se informa el error al controller.
  if (!socio) {
    throw new AppError(
      "No existe un socio asociado al usuario autenticado",
      404,
    );
  }

  return socio;
};

// Servicio encargado de registrar la aceptación
// del consentimiento informado por parte del socio.
//
// Esta operación solamente puede ser ejecutada
// por un socio autenticado utilizando su propio token JWT.
export const aceptarConsentimiento = async (usuarioId) => {
  // Busca el socio asociado al usuario autenticado.
  // usuarioId proviene del token JWT validado previamente
  // por el middleware de autenticación.
  const socio = await prisma.socio.findUnique({
    where: {
      usuario_id: usuarioId,
    },
  });

  // Valida que exista un socio asociado al usuario autenticado.
  // Esto evita inconsistencias o accesos inválidos.
  if (!socio) {
    throw new AppError(
      "No existe un socio asociado al usuario autenticado",
      404,
    );
  }

  // Verifica si el consentimiento ya había sido aceptado anteriormente.
  // Esto evita registrar múltiples aceptaciones innecesarias.
  if (socio.consentimiento_aceptado) {
    throw new AppError("El consentimiento ya fue aceptado", 409);
  }

  // Actualiza el consentimiento del socio.
  // Se registra:
  // - consentimiento_aceptado = true
  // - fecha exacta de aceptación
  // - fecha de actualización del registro
  const socioActualizado = await prisma.socio.update({
    where: {
      id: socio.id,
    },

    data: {
      consentimiento_aceptado: true,

      // Registra la fecha y hora exacta
      // en que el socio aceptó los términos.
      fecha_consentimiento: new Date(),

      // Actualiza la fecha general de modificación.
      fecha_actualizacion: new Date(),
    },
  });

  // Devuelve el socio actualizado al controller.
  return socioActualizado;
};
