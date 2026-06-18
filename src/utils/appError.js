// Error personalizado para manejar errores controlados de la aplicación.
// Permite definir un mensaje y un código HTTP específico.
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
