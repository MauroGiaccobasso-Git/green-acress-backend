import jwt from "jsonwebtoken";
/*
  Middleware de autenticación con JWT

  ¿Qué hace este código?

  Este middleware actúa como un "filtro de seguridad" para proteger rutas del backend.

  Cada vez que llega una request, revisa si el cliente envió un token JWT en el header Authorization.
  
  - Si el token NO existe → rechaza la request
  - Si el token es inválido o expiró → rechaza la request
  - Si el token es válido → permite continuar hacia el controller

  Además, extrae la información del usuario desde el token y la guarda en req.usuario
  para poder usarla en las siguientes capas del sistema.

  En resumen:
 Verifica si el usuario está autenticado antes de permitir acceso
 */

export const verificarToken = (req, res, next) => {
  // Se obtiene el header Authorization de la request
  const authHeader = req.headers.authorization;

  // Si no viene el header, significa que el usuario no envió token
  if (!authHeader) {
    return res.status(401).json({
      message: "Token no proporcionado",
    });
  }

  // Se separa "Bearer TOKEN" y se obtiene solo el token
  const token = authHeader.split(" ")[1];

  try {
    // Se verifica el token usando la clave secreta
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Se guarda el usuario dentro de la request
    req.usuario = decoded;

    // Se permite continuar al controller
    next();
  } catch (error) {
    // Si el token es inválido o expiró, se bloquea el acceso\

    return res.status(401).json({
      message: "Token inválido o expirado",
    });
  }
};
