// Importa la lógica de autenticación desde la capa service.
// El controller delega toda la lógica de negocio al service.
import { loginUsuario } from "../services/authService.js";

// Importa el wrapper reutilizable para manejo automático de errores async.
// Permite evitar bloques try/catch repetidos en controllers.
import { asyncHandler } from "../utils/asyncHandler.js";

// Controller de login.
// Se envuelve con asyncHandler para que cualquier error
// sea capturado automáticamente y derivado al middleware global errorHandler.
export const login = asyncHandler(async (req, res) => {
  // Obtiene email y password enviados desde el frontend/Postman.
  const { email, password } = req.body;

  // Ejecuta la lógica de autenticación desde el service.
  // Si ocurre un error, asyncHandler lo captura automáticamente.
  const resultado = await loginUsuario(email, password);

  // Si el login es exitoso,
  // retorna respuesta HTTP 200 con los datos autenticados.
  return res.status(200).json(resultado);
});