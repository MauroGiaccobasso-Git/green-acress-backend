import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

/*
  Middleware de autenticación con JWT.

  Responsabilidades:
  1. Verificar que la request tenga token.
  2. Validar que el token sea válido.
  3. Consultar la base de datos para confirmar que el usuario sigue existiendo.
  4. Validar que el usuario siga ACTIVO.
  5. Guardar los datos del usuario autenticado en req.usuario.
*/
export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Si no se envía el header Authorization, se bloquea el acceso.
  if (!authHeader) {
    return res.status(401).json({
      message: "Token no proporcionado",
    });
  }

  // El header llega con formato:
  // Authorization: Bearer TOKEN
  // Por eso se separa por espacio y se toma la segunda parte.
  const token = authHeader.split(" ")[1];

  try {
    // Verifica que el token sea válido y no esté expirado.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Busca el usuario real en la base de datos.
    // Esto permite detectar si fue desactivado después de haber iniciado sesión.
    const usuario = await prisma.usuario.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        email: true,
        rol: true,
        estado: true,
      },
    });

    // Si el usuario ya no existe, se rechaza el acceso.
    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no encontrado",
      });
    }

    // Si el usuario fue desactivado, no puede seguir usando rutas protegidas.
    if (usuario.estado !== "ACTIVO") {
      return res.status(403).json({
        message: "Usuario inactivo",
      });
    }

    // Guarda los datos actualizados del usuario en la request.
    // Las siguientes capas podrán usar req.usuario.
    req.usuario = usuario;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido o expirado",
    });
  }
};

/*
  Middleware de control de consentimiento informado.

  Debe ejecutarse después de verificarToken y autorizarRoles("SOCIO"),
  porque utiliza req.usuario para identificar al socio autenticado.

  Bloquea el acceso a las funcionalidades privadas del Portal
  mientras el socio no haya aceptado el consentimiento informado.
*/
export const verificarConsentimientoSocio = async (req, res, next) => {
  try {
    const socio = await prisma.socio.findUnique({
      where: {
        usuario_id: req.usuario.id,
      },
      select: {
        id: true,
        consentimiento_aceptado: true,
      },
    });

    if (!socio) {
      return res.status(403).json({
        message: "No existe un socio asociado al usuario autenticado",
      });
    }

    if (!socio.consentimiento_aceptado) {
      return res.status(403).json({
        message: "Debe aceptar el consentimiento informado para continuar",
      });
    }

    req.socio = socio;

    next();
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible validar el consentimiento informado",
    });
  }
};

/*
  Middleware de autorización por roles.

  Debe ejecutarse después de verificarToken,
  porque utiliza req.usuario para saber qué rol tiene el usuario autenticado.
*/
export const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    // Si no existe req.usuario, significa que no pasó correctamente por verificarToken.
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado",
      });
    }

    // Valida que el rol del usuario esté dentro de los roles permitidos.
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        message: "No tiene permisos para acceder a este recurso",
      });
    }

    // Si el rol está permitido, continúa hacia el controller.
    next();
  };
};
