import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../utils/appError.js";
import { descifrar } from "../utils/encryption.js";
import { enviarRecuperacionPassword } from "./email/emailService.js";
import { registrarAuditoriaSistema } from "./auditoriaService.js";
import {
  validarCodigoMfa,
  validarCodigoRecuperacionMfa,
} from "./mfaService.js";

/* =========================================================
   CONSTANTES
========================================================= */

// Mensaje público único para evitar revelar si un email existe,
// si la contraseña es incorrecta o si la cuenta no puede ingresar.
const MENSAJE_CREDENCIALES_INVALIDAS = "Email o contraseña incorrectos";

// Respuesta pública única para no revelar si un email está registrado.
const MENSAJE_RECUPERACION_SOLICITADA =
  "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña";

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

// Tiempo de vigencia de un enlace de recuperación.
const RECUPERACION_PASSWORD_EXPIRA_MS = 30 * 60 * 1000;

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

// Valida que el email requerido para recuperación haya sido enviado.
const validarEmailRecuperacion = (email) => {
  if (!email) {
    throw new AppError("El email es obligatorio", 400, "AUTH_EMAIL_REQUIRED");
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

// Genera un token criptográficamente seguro para recuperación.
const generarTokenRecuperacion = () => randomBytes(32).toString("hex");

// Genera un hash irreversible del token recibido por email.
const hashearTokenRecuperacion = (token) =>
  createHash("sha256").update(token).digest("hex");

// Construye la URL que recibirá el socio por correo.
const construirRecoveryUrl = (token) => {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new AppError(
      "La URL del frontend no se encuentra configurada",
      500,
      "AUTH_FRONTEND_URL_NOT_CONFIGURED",
    );
  }

  return `${frontendUrl.replace(/\/$/, "")}/restablecer-password?token=${encodeURIComponent(token)}`;
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
  const nuevosIntentos = Math.min(intentosActuales + 1, MAX_INTENTOS_FALLIDOS);

  const retraso = RETARDOS_LOGIN[nuevosIntentos] ?? 30000;

  await prisma.usuario.update({
    where: {
      id: usuarioId,
    },
    data: {
      intentos_fallidos: nuevosIntentos,
      ultimo_intento_fallido: new Date(),
      proximo_intento_desde: new Date(Date.now() + retraso),
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

  const proximoIntento = obtenerProximoIntentoPermitido(usuario);

  if (proximoIntento) {
    throw new AppError(
      "Demasiados intentos fallidos. Espere antes de volver a intentar",
      429,
      "AUTH_TOO_MANY_ATTEMPTS",
    );
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValida || usuario.estado !== "ACTIVO") {
    await registrarIntentoFallido(usuario.id, usuario.intentos_fallidos);

    lanzarErrorCredencialesInvalidas();
  }

  await limpiarIntentosFallidos(usuario.id);

  validarPasswordTemporalVigente(usuario);

  if (usuario.requiere_cambio_password) {
    throw new AppError(
      "Debe cambiar su contraseña antes de continuar",
      403,
      "AUTH_PASSWORD_CHANGE_REQUIRED",
    );
  }

  const requiereConsentimiento =
    usuario.rol === "SOCIO" && usuario.socio?.consentimiento_aceptado === false;

  /* =========================================================
     VALIDACIÓN MFA ADMIN
  ========================================================= */

  /*
    Si el usuario es administrador y tiene MFA habilitado,
    no se entrega todavía el JWT definitivo.

    Primero debe completar el segundo factor
    mediante un código TOTP generado por su aplicación
    autenticadora.
  */
  if (usuario.rol === "ADMIN" && usuario.mfa_habilitado) {
    return {
      message: "Código MFA requerido",
      requiereMfa: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        estado: usuario.estado,
      },
    };
  }

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
   VERIFICACIÓN MFA LOGIN
========================================================= */

/**
 * Completa el segundo factor de autenticación
 * para administradores con MFA habilitado.
 *
 * Flujo:
 *
 * Email + contraseña
 *        ↓
 * MFA requerido
 *        ↓
 * Código TOTP
 *        ↓
 * Validación del secreto MFA
 *        ↓
 * Generación JWT definitivo
 */
export const verificarMfaLoginUsuario = async (usuarioId, codigo) => {
  const usuario = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      id: true,
      email: true,
      rol: true,
      estado: true,
      version_sesion: true,
      mfa_habilitado: true,
      mfa_secreto_cifrado: true,
    },
  });

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
  }

  if (usuario.rol !== "ADMIN" || !usuario.mfa_habilitado) {
    throw new AppError(
      "El usuario no tiene MFA habilitado",
      400,
      "MFA_NOT_ENABLED",
    );
  }

  if (!usuario.mfa_secreto_cifrado) {
    throw new AppError(
      "El secreto MFA no se encuentra configurado",
      500,
      "MFA_SECRET_NOT_CONFIGURED",
    );
  }

  const secreto = descifrar(usuario.mfa_secreto_cifrado);

  const codigoValido = await validarCodigoMfa(secreto, codigo);

  if (!codigoValido) {
    throw new AppError("Código MFA incorrecto", 401, "MFA_INVALID_CODE");
  }

  const token = generarTokenSesion(usuario);

  return {
    message: "Login correcto",
    token,
    requiereMfa: false,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
    },
  };
};

/* =========================================================
   VERIFICACIÓN MFA MEDIANTE CÓDIGO DE RECUPERACIÓN
========================================================= */

/**
 * Completa el segundo factor utilizando un código
 * de recuperación MFA.
 *
 * Este flujo se utiliza cuando el administrador
 * no dispone del código TOTP generado por su
 * aplicación autenticadora.
 *
 * Los códigos de recuperación funcionan como
 * llaves de emergencia de un solo uso.
 *
 * Flujo:
 *
 * Email + contraseña
 *        ↓
 * MFA requerido
 *        ↓
 * Código recuperación
 *        ↓
 * Validación del código
 *        ↓
 * Generación JWT definitivo
 */
export const verificarMfaRecuperacionLoginUsuario = async (
  usuarioId,
  codigo,
) => {
  const usuario = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      id: true,
      email: true,
      rol: true,
      estado: true,
      version_sesion: true,
      mfa_habilitado: true,
    },
  });

  if (!usuario) {
    throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
  }

  if (usuario.rol !== "ADMIN" || !usuario.mfa_habilitado) {
    throw new AppError(
      "El usuario no tiene MFA habilitado",
      400,
      "MFA_NOT_ENABLED",
    );
  }

  const codigoValido = await validarCodigoRecuperacionMfa(usuario.id, codigo);

  if (!codigoValido) {
    throw new AppError(
      "Código de recuperación MFA incorrecto",
      401,
      "MFA_RECOVERY_CODE_INVALID",
    );
  }

  const token = generarTokenSesion(usuario);

  return {
    message: "Login correcto",
    token,
    requiereMfa: false,
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

export const cambiarPasswordUsuario = async (
  email,
  passwordActual,
  nuevaPassword,
) => {
  const emailNormalizado = normalizarEmail(email);

  validarCredenciales(emailNormalizado, passwordActual);

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

  const nuevoPasswordHash = await bcrypt.hash(nuevaPassword, 10);

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
   RECUPERACIÓN DE PASSWORD
========================================================= */

export const solicitarRecuperacionPassword = async (email) => {
  const emailNormalizado = normalizarEmail(email);

  validarEmailRecuperacion(emailNormalizado);

  const respuestaPublica = {
    message: MENSAJE_RECUPERACION_SOLICITADA,
  };

  const usuario = await prisma.usuario.findUnique({
    where: {
      email: emailNormalizado,
    },
    include: {
      socio: {
        select: {
          nombre: true,
        },
      },
    },
  });

  if (!usuario) {
    return respuestaPublica;
  }

  const token = generarTokenRecuperacion();

  const tokenHash = hashearTokenRecuperacion(token);

  const expiraEn = new Date(Date.now() + RECUPERACION_PASSWORD_EXPIRA_MS);

  const recuperacion = await prisma.$transaction(async (tx) => {
    await tx.recuperacionPassword.updateMany({
      where: {
        usuario_id: usuario.id,
        consumido_en: null,
      },
      data: {
        consumido_en: new Date(),
      },
    });

    const nuevaRecuperacion = await tx.recuperacionPassword.create({
      data: {
        usuario_id: usuario.id,
        token_hash: tokenHash,
        expira_en: expiraEn,
      },
    });

    await registrarAuditoriaSistema(
      {
        accion: "SOLICITAR_RECUPERACION_PASSWORD",
        entidad: "Usuario",
        entidadId: usuario.id,
        detalle:
          "Se generó un enlace de recuperación de contraseña con vigencia de 30 minutos.",
      },
      tx,
    );

    return nuevaRecuperacion;
  });

  const recoveryUrl = construirRecoveryUrl(token);

  try {
    await enviarRecuperacionPassword({
      nombre: usuario.socio?.nombre || "usuario",
      email: usuario.email,
      recoveryUrl,
    });
  } catch {
    await prisma.recuperacionPassword.updateMany({
      where: {
        id: recuperacion.id,
        consumido_en: null,
      },
      data: {
        consumido_en: new Date(),
      },
    });

    throw new AppError(
      "No fue posible enviar el correo de recuperación",
      503,
      "AUTH_RECOVERY_EMAIL_FAILED",
    );
  }

  return respuestaPublica;
};
export const restablecerPasswordUsuario = async (token, nuevaPassword) => {
  if (typeof token !== "string" || !token.trim()) {
    throw new AppError(
      "El token de recuperación es obligatorio",
      400,
      "AUTH_RECOVERY_TOKEN_REQUIRED",
    );
  }

  validarPasswordSegura(nuevaPassword);

  const tokenHash = hashearTokenRecuperacion(token.trim());

  const recuperacion = await prisma.recuperacionPassword.findUnique({
    where: {
      token_hash: tokenHash,
    },
    include: {
      usuario: true,
    },
  });

  if (
    !recuperacion ||
    recuperacion.consumido_en ||
    new Date() > recuperacion.expira_en
  ) {
    throw new AppError(
      "El enlace de recuperación es inválido o expiró",
      400,
      "AUTH_RECOVERY_TOKEN_INVALID",
    );
  }

  const passwordReutilizada = await bcrypt.compare(
    nuevaPassword,
    recuperacion.usuario.password_hash,
  );

  if (passwordReutilizada) {
    throw new AppError(
      "La nueva contraseña debe ser diferente de la contraseña actual",
      400,
      "AUTH_PASSWORD_REUSE_NOT_ALLOWED",
    );
  }

  const nuevoPasswordHash = await bcrypt.hash(nuevaPassword, 10);

  await prisma.$transaction(async (tx) => {
    const consumo = await tx.recuperacionPassword.updateMany({
      where: {
        id: recuperacion.id,
        consumido_en: null,
        expira_en: {
          gt: new Date(),
        },
      },
      data: {
        consumido_en: new Date(),
      },
    });

    if (consumo.count !== 1) {
      throw new AppError(
        "El enlace de recuperación es inválido o expiró",
        400,
        "AUTH_RECOVERY_TOKEN_INVALID",
      );
    }

    await tx.recuperacionPassword.updateMany({
      where: {
        usuario_id: recuperacion.usuario_id,
        consumido_en: null,
      },
      data: {
        consumido_en: new Date(),
      },
    });

    await tx.usuario.update({
      where: {
        id: recuperacion.usuario_id,
      },
      data: {
        password_hash: nuevoPasswordHash,

        requiere_cambio_password: false,

        password_temporal_expira: null,

        intentos_fallidos: 0,

        ventana_intentos_desde: null,

        ultimo_intento_fallido: null,

        proximo_intento_desde: null,

        version_sesion: {
          increment: 1,
        },
      },
    });

    await registrarAuditoriaSistema(
      {
        accion: "RESTABLECER_PASSWORD",

        entidad: "Usuario",

        entidadId: recuperacion.usuario_id,

        detalle:
          "La contraseña fue restablecida mediante un enlace de recuperación y se invalidaron las sesiones anteriores.",
      },
      tx,
    );
  });

  return {
    message: "Contraseña restablecida correctamente",
  };
};

/* =========================================================
   CIERRE DE SESIÓN
========================================================= */

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
    throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
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
