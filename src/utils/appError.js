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
    code = "INTERNAL_ERROR",
    isOperational = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace?.(this, this.constructor);
  }
}