// Clase utilizada para representar errores operacionales controlados de la aplicación.
//
// Permite definir:
// - un mensaje seguro para el cliente;
// - el código HTTP correspondiente;
// - un código interno estable que podrá utilizar el frontend;
// - la identificación de errores operacionales frente a errores inesperados.

export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = null,
    isOperational = true,
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code =
      code || this.obtenerCodigoPorStatus(statusCode);
    this.isOperational = isOperational;

    Error.captureStackTrace?.(
      this,
      this.constructor,
    );
  }

  obtenerCodigoPorStatus(statusCode) {
    switch (statusCode) {
      case 400:
        return "VALIDATION_ERROR";

      case 401:
        return "UNAUTHORIZED";

      case 403:
        return "FORBIDDEN";

      case 404:
        return "NOT_FOUND";

      case 409:
        return "CONFLICT";

      default:
        return "INTERNAL_ERROR";
    }
  }
}