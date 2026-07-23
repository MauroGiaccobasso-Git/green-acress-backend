import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES
========================================================= */

// Mensaje público único para evitar revelar si un email existe,
// si la contraseña es incorrecta o si la cuenta no puede ingresar.
const MENSAJE_CREDENCIALES_INVALIDAS = "Email o contraseña incorrectos";

// Cantidad máxima utilizada para calcular el retraso progresivo.
// No bloquea la cuenta.
const MAX_INTENTOS_FALLIDOS = 5;

// Tiempo durante el cual los intentos se consideran consecutivos.
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

// Retrasos progresivos entre intentos fallidos.
const RETARDOS_LOGIN = {
  1: 0,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 30000,
};

/* =========================================================
   HELPERS
========================================================= */

// Normaliza el email para evitar diferencias por espacios o mayúsculas.
const normalizarEmail = (email) => {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
};

// Valida que las credenciales obligatorias hayan sido enviadas.
const validarCredenciales = (email, password) => {
  if (!email || typeof password !== "string" || !password) {
    throw new AppError(
      "Email y contraseña son obligatorios",
      400,
      "AUTH_CREDENTIALS_REQUIRED",
    );
  }
};

// Valida requisitos mínimos de una contraseña definitiva.
const validarPasswordSegura = (password) => {
  const passwordValida =
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!passwordValida) {
    throw new AppError(
      "La contraseña no cumple los requisitos de seguridad",
      400,
      "AUTH_WEAK_PASSWORD",
    );
  }
};

// Genera el token de una sesión autenticada.
//
// type identifica que es una sesión definitiva.
// versionSesion permite invalidar tokens antiguos.
const generarTokenSesion = (usuario) =>
  jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      type: "SESSION",
      versionSesion: usuario.version_sesion,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  );

// Lanza siempre la misma respuesta pública ante credenciales no válidas.
const lanzarErrorCredencialesInvalidas = () => {
  throw new AppError(
    MENSAJE_CREDENCIALES_INVALIDAS,
    401,
    "AUTH_INVALID_CREDENTIALS",
  );
};

/*
  Valida si la contraseña temporal del usuario sigue vigente.

  Las contraseñas temporales tienen una fecha límite
  de utilización.

  Si la fecha fue superada:
  - no permite continuar el login;
  - obliga a solicitar una nueva contraseña temporal.
*/
const validarPasswordTemporalVigente = (usuario) => {
  if (
    usuario.requiere_cambio_password &&
    usuario.password_temporal_expira &&
    new Date() > usuario.password_temporal_expira
  ) {
    throw new AppError(
      "La contraseña temporal expiró",
      401,
      "AUTH_TEMPORARY_PASSWORD_EXPIRED",
    );
  }
};

/*
  Verifica si existe un retraso activo antes del próximo intento.

  No bloquea la cuenta.
  Solamente evita intentos consecutivos demasiado rápidos.
*/
const obtenerProximoIntentoPermitido = (usuario) => {
  if (!usuario.proximo_intento_desde) {
    return null;
  }

  const ahora = new Date();

  if (ahora < usuario.proximo_intento_desde) {
    return usuario.proximo_intento_desde;
  }

  return null;
};

/*
  Registra un intento fallido de autenticación.

  Actualiza:
  - contador;
  - último intento;
  - próximo momento permitido.
*/
const registrarIntentoFallido = async (usuarioId, intentosActuales) => {
  const nuevosIntentos = Math.min(
    intentosActuales + 1,
    MAX_INTENTOS_FALLIDOS,
  );

  const retraso = RETARDOS_LOGIN[nuevosIntentos] ?? 30000;

  await prisma.usuario.update({
    where: {
      id: usuarioId,
    },
    data: {
      intentos_fallidos: nuevosIntentos,
      ultimo_intento_fallido: new Date(),
      proximo_intento_desde: new Date(
        Date.now() + retraso,
      ),
    },
  });
};

/*
  Limpia información de intentos fallidos después
  de una autenticación correcta.
*/
const limpiarIntentosFallidos = async (usuarioId) => {
  await prisma.usuario.update({
    where: {
      id: usuarioId,
    },
    data: {
      intentos_fallidos: 0,
      ventana_intentos_desde: null,
      ultimo_intento_fallido: null,
      proximo_intento_desde: null,
    },
  });
};

/* =========================================================
   AUTH SERVICE
========================================================= */

// Autentica al usuario y genera una sesión definitiva.
export const loginUsuario = async (email, password) => {
  const emailNormalizado = normalizarEmail(email);

  validarCredenciales(emailNormalizado, password);

  const usuario = await prisma.usuario.findUnique({
    where: {
      email: emailNormalizado,
    },
    include: {
      socio: true,
    },
  });

  if (!usuario) {
    lanzarErrorCredencialesInvalidas();
  }

  // Verifica si existe una espera activa por intentos fallidos.
  const proximoIntento = obtenerProximoIntentoPermitido(usuario);

  if (proximoIntento) {
    throw new AppError(
      "Demasiados intentos fallidos. Espere antes de volver a intentar",
      429,
      "AUTH_TOO_MANY_ATTEMPTS",
    );
  }

  const passwordValida = await bcrypt.compare(
    password,
    usuario.password_hash,
  );

  if (!passwordValida || usuario.estado !== "ACTIVO") {
    await registrarIntentoFallido(
      usuario.id,
      usuario.intentos_fallidos,
    );

    lanzarErrorCredencialesInvalidas();
  }

  // Si la autenticación fue correcta,
  // limpiamos intentos fallidos anteriores.
  await limpiarIntentosFallidos(usuario.id);

  // Valida si la contraseña temporal sigue vigente.
  validarPasswordTemporalVigente(usuario);

  /*
    Si el usuario ingresó utilizando una contraseña temporal,
    debe establecer una contraseña definitiva antes
    de acceder al sistema.
  */
  if (usuario.requiere_cambio_password) {
    throw new AppError(
      "Debe cambiar su contraseña antes de continuar",
      403,
      "AUTH_PASSWORD_CHANGE_REQUIRED",
    );
  }

  const requiereConsentimiento =
    usuario.rol === "SOCIO" &&
    usuario.socio?.consentimiento_aceptado === false;

  const token = generarTokenSesion(usuario);

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

/* =========================================================
   CAMBIO DE PASSWORD
========================================================= */

// Cambia una contraseña temporal por una contraseña definitiva.
//
// Este flujo:
// - valida contraseña actual;
// - valida nueva contraseña;
// - elimina obligación de cambio;
// - invalida sesiones anteriores.
export const cambiarPasswordUsuario = async (
  email,
  passwordActual,
  nuevaPassword,
) => {
  const emailNormalizado = normalizarEmail(email);

  validarCredenciales(
    emailNormalizado,
    passwordActual,
  );

  validarPasswordSegura(nuevaPassword);

  const usuario = await prisma.usuario.findUnique({
    where: {
      email: emailNormalizado,
    },
  });

  if (!usuario) {
    lanzarErrorCredencialesInvalidas();
  }

  const passwordActualValida = await bcrypt.compare(
    passwordActual,
    usuario.password_hash,
  );

  if (!passwordActualValida) {
    lanzarErrorCredencialesInvalidas();
  }

  validarPasswordTemporalVigente(usuario);

  const nuevoPasswordHash = await bcrypt.hash(
    nuevaPassword,
    10,
  );

  await prisma.usuario.update({
    where: {
      id: usuario.id,
    },
    data: {
      password_hash: nuevoPasswordHash,
      requiere_cambio_password: false,
      password_temporal_expira: null,
      version_sesion: {
        increment: 1,
      },
    },
  });

  return {
    message: "Contraseña actualizada correctamente",
  };
};

/* =========================================================
   CIERRE DE SESIÓN
========================================================= */

// Invalida todas las sesiones activas incrementando la versión.
// Los JWT anteriores quedan rechazados automáticamente.
export const cerrarSesion = async (usuarioId) => {
  const usuario = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      id: true,
    },
  });

  if (!usuario) {
    throw new AppError(
      "Usuario no encontrado",
      404,
      "USER_NOT_FOUND",
    );
  }

  await prisma.usuario.update({
    where: {
      id: usuarioId,
    },
    data: {
      version_sesion: {
        increment: 1,
      },
    },
  });

  return {
    message: "Sesión cerrada correctamente",
  };
};