import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   HELPERS DE AUTENTICACIÓN
========================================================= */

// Obtiene el token y valida el formato exacto:
// Authorization: Bearer TOKEN
const obtenerTokenBearer = (authHeader) => {
  if (typeof authHeader !== "string") {
    throw new AppError(
      "No se proporcionó una sesión válida",
      401,
      "AUTH_TOKEN_REQUIRED",
    );
  }

  const partes = authHeader.trim().split(/\s+/);

  if (partes.length !== 2 || partes[0] !== "Bearer" || !partes[1]) {
    throw new AppError(
      "No se proporcionó una sesión válida",
      401,
      "AUTH_TOKEN_INVALID_FORMAT",
    );
  }

  return partes[1];
};

// Verifica la firma, el vencimiento y la estructura mínima del token.
const decodificarTokenSesion = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof decoded !== "object" ||
      decoded.type !== "SESSION" ||
      !Number.isInteger(decoded.id) ||
      !Number.isInteger(decoded.versionSesion)
    ) {
      throw new AppError(
        "La sesión no es válida",
        401,
        "AUTH_SESSION_INVALID",
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "TokenExpiredError") {
      throw new AppError(
        "La sesión expiró",
        401,
        "AUTH_SESSION_EXPIRED",
      );
    }

    throw new AppError(
      "La sesión no es válida",
      401,
      "AUTH_SESSION_INVALID",
    );
  }
};

/* =========================================================
   MIDDLEWARE DE AUTENTICACIÓN
========================================================= */

/*
  Valida la sesión JWT y consulta el usuario real en la base de datos.

  La versión de sesión permite invalidar tokens anteriores cuando el usuario
  cambia su contraseña o se revoca su acceso.
*/
export const verificarToken = async (req, res, next) => {
  try {
    const token = obtenerTokenBearer(req.headers.authorization);
    const decoded = decodificarTokenSesion(token);

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        email: true,
        rol: true,
        estado: true,
        version_sesion: true,
      },
    });

    if (!usuario || usuario.estado !== "ACTIVO") {
      throw new AppError(
        "La sesión no es válida",
        401,
        "AUTH_SESSION_INVALID",
      );
    }

    // Si la versión guardada cambió, el token pertenece a una sesión revocada.
    if (usuario.version_sesion !== decoded.versionSesion) {
      throw new AppError(
        "La sesión fue cerrada o revocada",
        401,
        "AUTH_SESSION_REVOKED",
      );
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   MIDDLEWARE DE CONSENTIMIENTO
========================================================= */

/*
  Bloquea las funcionalidades privadas del Portal de Socios hasta que
  el consentimiento informado haya sido aceptado.
*/
export const verificarConsentimientoSocio = async (req, res, next) => {
  try {
    const socio = await prisma.socio.findUnique({
      where: {
        usuario_id: req.usuario.id,
      },
      select: {
        id: true,
        estado: true,
        consentimiento_aceptado: true,
      },
    });

    if (!socio) {
      throw new AppError(
        "No existe un socio asociado al usuario autenticado",
        403,
        "SOCIO_NOT_ASSOCIATED",
      );
    }

    if (!socio.consentimiento_aceptado) {
      throw new AppError(
        "Debe aceptar el consentimiento informado para continuar",
        403,
        "SOCIO_CONSENT_REQUIRED",
      );
    }

    req.socio = socio;

    next();
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   MIDDLEWARE DE ESTADO DEL SOCIO
========================================================= */

/*
  Permite realizar operaciones únicamente a socios en estado ACTIVO.

  Los socios INACTIVOS pueden acceder al portal y consultar información,
  pero no pueden generar nuevas operaciones.
*/
export const requerirSocioActivo = async (req, res, next) => {
  try {
    let socio = req.socio;

    if (!socio) {
      socio = await prisma.socio.findUnique({
        where: {
          usuario_id: req.usuario.id,
        },
        select: {
          id: true,
          estado: true,
        },
      });
    }

    if (!socio) {
      throw new AppError(
        "No existe un socio asociado al usuario autenticado",
        403,
        "SOCIO_NOT_ASSOCIATED",
      );
    }

    if (socio.estado !== "ACTIVO") {
      throw new AppError(
        "El socio no se encuentra habilitado para realizar esta operación",
        403,
        "SOCIO_NOT_ACTIVE",
      );
    }

    req.socio = socio;

    next();
  } catch (error) {
    next(error);
  }
};

/* =========================================================
   MIDDLEWARE DE AUTORIZACIÓN
========================================================= */

/*
  Permite continuar únicamente a los roles indicados en la ruta.
  Debe ejecutarse después de verificarToken.
*/
export const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(
        new AppError(
          "Usuario no autenticado",
          401,
          "AUTH_USER_NOT_AUTHENTICATED",
        ),
      );
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(
        new AppError(
          "No tiene permisos para acceder a este recurso",
          403,
          "AUTH_FORBIDDEN",
        ),
      );
    }

    next();
  };
};