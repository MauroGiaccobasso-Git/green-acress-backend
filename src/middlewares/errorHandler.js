// Middleware global para manejo centralizado de errores.
// Recibe errores lanzados desde controllers/services y responde de forma consistente.
export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";

  // Registrar siempre el error completo en el servidor.
  console.error(error);

  // Para errores inesperados se devuelve un mensaje genérico.
  if (!error.isOperational) {
    return res.status(500).json({
      message: "Ocurrió un error interno del servidor.",
      code: "INTERNAL_ERROR",
    });
  }

  // Para errores operacionales se devuelve el mensaje definido.
  return res.status(statusCode).json({
    message: error.message,
    code,
  });
};