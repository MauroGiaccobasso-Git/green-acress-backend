// Middleware global para manejo centralizado de errores.
// Recibe errores lanzados desde controllers/services y responde de forma consistente.
export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    message: error.message || "Error interno del servidor",
  });
};