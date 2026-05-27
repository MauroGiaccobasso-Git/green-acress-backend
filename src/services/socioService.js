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
export const obtenerSocios = async () => {
  // Consulta la tabla Socio utilizando Prisma ORM
  // include permite traer también la información básica del usuario asociado
  const socios = await prisma.socio.findMany({
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

  // Devuelve la lista de socios al controlador
  return socios;
};

// Servicio encargado de registrar un nuevo socio junto con su usuario asociado
// Esta función crea primero el Usuario con rol SOCIO y luego el Socio vinculado
export const crearSocio = async (datosSocio) => {
  // Desestructura los datos enviados desde el controlador
  const { email, password, documento, nombre, apellido, telefono } = datosSocio;

  // Valida que los campos obligatorios estén presentes antes de continuar.
  // Esto evita intentar crear usuarios o socios con información incompleta.
  if (!email || !password || !documento || !nombre || !apellido || !telefono) {
    throw new AppError(
      "Todos los campos obligatorios deben estar completos",
      400,
    );
  }

  // Valida que el email tenga un formato correcto.
  if (!validarEmail(email)) {
    throw new AppError("El formato del email no es válido", 400);
  }

  // Valida que la contraseña tenga una longitud mínima segura.
  if (!validarPassword(password)) {
    throw new AppError("La contraseña debe tener al menos 8 caracteres", 400);
  }

  // Valida que el documento tenga un formato válido.
  if (!validarDocumento(documento)) {
    throw new AppError("El documento ingresado no es válido", 400);
  }

  // Valida que el teléfono tenga un formato válido.
  if (!validarTelefono(telefono)) {
    throw new AppError("El teléfono ingresado no es válido", 400);
  }

  // Valida nombre y apellido.
  if (!validarTexto(nombre) || !validarTexto(apellido)) {
    throw new AppError("El nombre o apellido ingresado no es válido", 400);
  }

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

// Servicio encargado de actualizar los datos de un socio existente.
// Permite modificar información del socio y del usuario asociado.
export const actualizarSocio = async (id, datosSocio) => {
  // Convierte el id recibido desde la URL a número.
  // Express recibe los parámetros como string.
  const socioId = Number(id);

  // Extrae los datos enviados desde el controller.
  const { email, documento, nombre, apellido, telefono } = datosSocio;

  // Valida email si fue enviado.
  if (email && !validarEmail(email)) {
    throw new AppError("El formato del email no es válido", 400);
  }

  // Valida documento si fue enviado.
  if (documento && !validarDocumento(documento)) {
    throw new AppError("El documento ingresado no es válido", 400);
  }

  // Valida teléfono si fue enviado.
  if (telefono && !validarTelefono(telefono)) {
    throw new AppError("El teléfono ingresado no es válido", 400);
  }

  // Valida nombre y apellido si fueron enviados.
  if (
    (nombre && !validarTexto(nombre)) ||
    (apellido && !validarTexto(apellido))
  ) {
    throw new AppError("El nombre o apellido ingresado no es válido", 400);
  }

  // Busca el socio en la base de datos junto con su usuario asociado.
  // include permite traer la relación usuario.
  const socioExistente = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { usuario: true },
  });

  // Valida que el socio exista antes de continuar.
  if (!socioExistente) {
    throw new AppError("El socio indicado no existe", 404);
  }

  // Si el documento cambia,
  // valida que no exista otro socio con el mismo documento.
  if (documento && documento !== socioExistente.documento) {
    const documentoExistente = await prisma.socio.findUnique({
      where: { documento },
    });

    if (documentoExistente) {
      throw new AppError(
        "Ya existe un socio registrado con ese documento",
        409,
      );
    }
  }

  // Si el email cambia,
  // valida que no exista otro usuario con el mismo email.
  if (email && email !== socioExistente.usuario.email) {
    const emailExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (emailExistente) {
      throw new AppError("Ya existe un usuario registrado con ese email", 409);
    }
  }

  // Ejecuta la actualización dentro de una transacción.
  // Esto garantiza consistencia entre Usuario y Socio.
  const socioActualizado = await prisma.$transaction(async (tx) => {
    // Si se recibió un nuevo email,
    // actualiza también el usuario asociado.
    if (email) {
      await tx.usuario.update({
        where: { id: socioExistente.usuario_id },
        data: { email },
      });
    }

    // Actualiza los datos del socio.
    return await tx.socio.update({
      where: { id: socioId },

      data: {
        documento,
        nombre,
        apellido,
        telefono,

        // Actualiza la fecha de modificación.
        fecha_actualizacion: new Date(),
      },

      // Retorna también información básica del usuario asociado.
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

  // Devuelve el socio actualizado.
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
  // Convierte el id recibido desde la URL a número.
  const socioId = Number(id);

  // Valida que el estado recibido sea válido.
  // Esto evita registrar estados inexistentes.
  if (!validarEstado(nuevoEstado)) {
    throw new AppError("El estado ingresado no es válido", 400);
  }

  // Busca el socio junto con su usuario asociado.
  // include permite acceder también al usuario relacionado.
  const socioExistente = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { usuario: true },
  });

  // Verifica que el socio exista antes de continuar.
  if (!socioExistente) {
    throw new AppError("El socio indicado no existe", 404);
  }

  // Variable utilizada para resolver automáticamente
  // el estado que tendrá el usuario asociado.
  let estadoUsuario;

  // Si el socio queda ACTIVO,
  // el usuario también recupera acceso normal.
  if (nuevoEstado === "ACTIVO") {
    estadoUsuario = "ACTIVO";
  }

  // Si el socio queda INACTIVO,
  // el usuario también queda inactivo.
  if (nuevoEstado === "INACTIVO") {
    estadoUsuario = "INACTIVO";
  }

  // Si el socio queda SUSPENDIDO,
  // el usuario asociado se bloquea.
  if (nuevoEstado === "SUSPENDIDO") {
    estadoUsuario = "BLOQUEADO";
  }

  // Ejecuta toda la operación dentro de una transacción.
  // Esto garantiza consistencia entre Usuario y Socio.
  const socioActualizado = await prisma.$transaction(async (tx) => {
    // Actualiza primero el estado del usuario asociado.
    await tx.usuario.update({
      where: { id: socioExistente.usuario_id },

      data: {
        estado: estadoUsuario,

        // Registra fecha de actualización.
        fecha_actualizacion: new Date(),
      },
    });

    // Luego actualiza el estado del socio.
    return await tx.socio.update({
      where: { id: socioId },

      data: {
        estado: nuevoEstado,

        // Registra fecha de actualización.
        fecha_actualizacion: new Date(),
      },

      // Retorna también información básica
      // del usuario asociado.
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

  // Devuelve el socio actualizado.
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
