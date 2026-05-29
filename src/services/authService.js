import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/appError.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Valida campos obligatorios de login.
const validarCredenciales = (email, password) => {
  if (!email || !password) {
    throw new AppError("Email y contraseña son obligatorios", 400);
  }
};

/* =========================================================
   AUTH SERVICE
========================================================= */

// Función principal de login.
export const loginUsuario = async (email, password) => {
  validarCredenciales(email, password);

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      socio: true,
    },
  });

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 401);
  }

  if (usuario.estado !== "ACTIVO") {
    throw new AppError("El usuario se encuentra inactivo", 403);
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValida) {
    throw new AppError("Contraseña incorrecta", 401);
  }

  const requiereConsentimiento =
    usuario.rol === "SOCIO" && usuario.socio?.consentimiento_aceptado === false;

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  );

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
