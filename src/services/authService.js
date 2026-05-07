import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Función principal de login
// Recibe email y password desde el controller
export const loginUsuario = async (email, password) => {

  // Validación básica: se verifica que ambos campos existan
  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios");
  }

  // Búsqueda del usuario en la base de datos utilizando Prisma
  // Se busca por email ya que es único en el sistema
  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  // Si no existe un usuario con ese email, se corta el flujo
  if (!usuario) {
    throw new Error("Usuario no encontrado");
  }

  // Validación de contraseña con bcrypt
  // Se compara la contraseña ingresada con el hash almacenado en la base de datos
  const passwordValida = await bcrypt.compare(
    password,                 // contraseña en texto plano que envía el usuario
    usuario.password_hash     // hash almacenado en la base de datos
  );

  // Si la contraseña no coincide, se corta el flujo
  if (!passwordValida) {
    throw new Error("Contraseña incorrecta");
  }

  // Generación del token JWT
  // El token contiene datos mínimos del usuario autenticado
  // y será utilizado para validar futuras solicitudes al backend
  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );

  // Si el usuario existe y la contraseña es correcta,
  // se devuelve el token y los datos públicos del usuario
  return {
    message: "Login correcto",
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
    },
  };
};