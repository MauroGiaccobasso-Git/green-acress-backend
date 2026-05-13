import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";

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
  const {
    email,
    password,
    documento,
    nombre,
    apellido,
    telefono,
    consentimiento_aceptado,
  } = datosSocio;

  // Valida que los campos obligatorios estén presentes antes de continuar.
  // Esto evita intentar crear usuarios o socios con información incompleta.
  if (
    !email ||
    !password ||
    !documento ||
    !nombre ||
    !apellido ||
    !telefono ||
    consentimiento_aceptado === undefined
  ) {
    throw new Error("Todos los campos obligatorios deben estar completos");
  }

  // Valida si ya existe un socio con el mismo documento
  // Esto evita duplicar socios dentro del sistema
  const socioExistente = await prisma.socio.findUnique({
    where: {
      documento,
    },
  });

  if (socioExistente) {
    throw new Error("Ya existe un socio registrado con ese documento");
  }

  // Valida si ya existe un usuario con el mismo email
  // El email debe ser único porque se usa para iniciar sesión
  const usuarioExistente = await prisma.usuario.findUnique({
    where: {
      email,
    },
  });

  if (usuarioExistente) {
    throw new Error("Ya existe un usuario registrado con ese email");
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
        estado: "ACTIVO",
      },
    });

    // Crea el socio vinculado al usuario recién generado
    const socioCreado = await tx.socio.create({
      data: {
        usuario_id: nuevoUsuario.id,
        documento,
        nombre,
        apellido,
        telefono,
        consentimiento_aceptado,
        fecha_consentimiento: consentimiento_aceptado ? new Date() : null,
        estado: "ACTIVO",
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
  const { email, documento, nombre, apellido, telefono, estado } = datosSocio;

  // Busca el socio en la base de datos junto con su usuario asociado.
  // include permite traer la relación usuario.
  const socioExistente = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { usuario: true },
  });

  // Valida que el socio exista antes de continuar.
  if (!socioExistente) {
    throw new Error("El socio indicado no existe");
  }

  // Si el documento cambia,
  // valida que no exista otro socio con el mismo documento.
  if (documento && documento !== socioExistente.documento) {

    const documentoExistente = await prisma.socio.findUnique({
      where: { documento },
    });

    if (documentoExistente) {
      throw new Error("Ya existe un socio registrado con ese documento");
    }
  }

  // Si el email cambia,
  // valida que no exista otro usuario con el mismo email.
  if (email && email !== socioExistente.usuario.email) {

    const emailExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (emailExistente) {
      throw new Error("Ya existe un usuario registrado con ese email");
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
        estado,

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

// Servicio encargado de desactivar lógicamente un socio.
// No elimina datos de la base; únicamente cambia el estado.
export const desactivarSocio = async (id) => {

  // Convierte el id recibido desde la URL a número.
  const socioId = Number(id);

  // Busca el socio junto con el usuario relacionado.
  const socioExistente = await prisma.socio.findUnique({
    where: { id: socioId },
    include: { usuario: true },
  });

  // Verifica que el socio exista.
  if (!socioExistente) {
    throw new Error("El socio indicado no existe");
  }

  // Ejecuta la desactivación dentro de una transacción.
  // Esto evita inconsistencias entre Usuario y Socio.
  const socioDesactivado = await prisma.$transaction(async (tx) => {

    // Desactiva primero el usuario asociado.
    // Esto impide futuros inicios de sesión.
    await tx.usuario.update({
      where: { id: socioExistente.usuario_id },

      data: {
        estado: "INACTIVO",
        fecha_actualizacion: new Date(),
      },
    });

    // Luego desactiva el socio.
    return await tx.socio.update({
      where: { id: socioId },

      data: {
        estado: "INACTIVO",

        // Actualiza la fecha de modificación.
        fecha_actualizacion: new Date(),
      },

      // Retorna datos básicos del usuario asociado.
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

  // Devuelve el socio desactivado.
  return socioDesactivado;
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
    throw new Error("No existe un socio asociado al usuario autenticado");
  }

  return socio;
};