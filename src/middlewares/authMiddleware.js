import jwt from "jsonwebtoken";

/*
  Middleware de autenticación con JWT.
  Valida que la request incluya un token válido en el header Authorization.
  Si el token es correcto, guarda los datos del usuario autenticado en req.usuario.
*/
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token no proporcionado",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido o expirado",
    });
  }
};

/*
  Middleware de autorización por roles.
  Debe ejecutarse después de verificarToken, ya que utiliza req.usuario.
  Permite restringir rutas según roles habilitados, por ejemplo:
  autorizarRoles("ADMIN") o autorizarRoles("ADMIN", "SOCIO").
*/
export const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado",
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        message: "No tiene permisos para acceder a este recurso",
      });
    }

    next();
  };
};
