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
// Centraliza las validaciones de negocio y la operación sobre la base de datos.
export const actualizarSocio = async (id, datosSocio) => {
  // Obtiene los datos enviados para actualizar el socio
  const { documento, nombre, apellido, telefono, estado } = datosSocio;

  // Busca el socio en la base de datos utilizando su ID
  const socioExistente = await prisma.socio.findUnique({
    where: { id },
  });

  // Valida que el socio exista antes de intentar modificarlo
  if (!socioExistente) {
    throw new Error("El socio indicado no existe");
  }

  // Si se envía un nuevo documento,
  // se valida que no pertenezca a otro socio
  if (documento && documento !== socioExistente.documento) {
    const documentoDuplicado = await prisma.socio.findUnique({
      where: { documento },
    });

    // Si ya existe otro socio con el mismo documento,
    // se cancela la operación
    if (documentoDuplicado) {
      throw new Error("Ya existe un socio registrado con ese documento");
    }
  }

  // Actualiza la información del socio en la base de datos
  const socioActualizado = await prisma.socio.update({
    where: { id },
    data: {
      documento,
      nombre,
      apellido,
      telefono,
      estado,
    },

    // Incluye información básica del usuario relacionado
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

  // Retorna el socio actualizado
  return socioActualizado;
};

// Servicio encargado de realizar la desactivación lógica de un socio.
// La operación no elimina registros de la base de datos.
// Cambia el estado del socio a INACTIVO y también desactiva
// el usuario asociado para impedir el acceso al sistema.
export const desactivarSocio = async (id) => {
  // Busca el socio en la base de datos
  const socioExistente = await prisma.socio.findUnique({
    where: { id },
  });

  // Valida que el socio exista
  if (!socioExistente) {
    throw new Error("El socio indicado no existe");
  }

  // Valida que el socio no esté ya desactivado
  if (socioExistente.estado === "INACTIVO") {
    throw new Error("El socio ya se encuentra desactivado");
  }

  // Ejecuta la desactivación dentro de una transacción.
  // Esto garantiza que se actualicen socio y usuario juntos.
  const socioDesactivado = await prisma.$transaction(async (tx) => {
    // Actualiza el estado del socio
    const socioActualizado = await tx.socio.update({
      where: { id },
      data: {
        estado: "INACTIVO",
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

    // Actualiza el estado del usuario asociado
    await tx.usuario.update({
      where: {
        id: socioExistente.usuario_id,
      },
      data: {
        estado: "INACTIVO",
      },
    });

    // Consulta nuevamente el socio para devolverlo
    // con el usuario asociado ya actualizado
    const socioConUsuarioActualizado = await tx.socio.findUnique({
      where: { id },
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

    return socioConUsuarioActualizado;
  });

  return socioDesactivado;
};