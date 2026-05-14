import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Función principal de login.
// Recibe email y password enviados desde el controller.
export const loginUsuario = async (email, password) => {
  // Validación básica:
  // se verifica que ambos campos hayan sido enviados.
  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios");
  }

  // Busca el usuario en la base de datos utilizando Prisma.
  // El email se utiliza porque debe ser único dentro del sistema.
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      socio: true,
    },
  });

  // Si no existe un usuario con ese email,
  // se corta el flujo de autenticación.
  if (!usuario) {
    throw new Error("Usuario no encontrado");
  }

  // Valida que el usuario se encuentre ACTIVO.
  // Aunque las credenciales sean correctas,
  // un usuario INACTIVO no puede acceder al sistema.
  if (usuario.estado !== "ACTIVO") {
    throw new Error("El usuario se encuentra inactivo");
  }

  // Validación de contraseña utilizando bcrypt.
  // Se compara la contraseña ingresada con el hash almacenado.
  const passwordValida = await bcrypt.compare(
    password, // contraseña ingresada por el usuario
    usuario.password_hash, // hash guardado en base de datos
  );

  // Si la contraseña no coincide,
  // se corta el flujo de autenticación.
  if (!passwordValida) {
    throw new Error("Contraseña incorrecta");
  }
  // Determina si el usuario autenticado es socio
  // y todavía tiene pendiente aceptar el consentimiento informado.
  const requiereConsentimiento =
    usuario.rol === "SOCIO" && usuario.socio?.consentimiento_aceptado === false;

  // Generación del token JWT.
  // El token contiene información mínima del usuario autenticado
  // y será utilizado para acceder a rutas protegidas.
  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    },

    // Clave secreta utilizada para firmar el token.
    process.env.JWT_SECRET,

    {
      // Tiempo de expiración configurado desde variables de entorno.
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  );

  // Si todas las validaciones son correctas,
  // se devuelve el token y los datos públicos del usuario.
  return {
    message: "Login correcto",

    token,

    requiereConsentimiento,

    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
    },
  };
};
