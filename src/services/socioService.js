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
