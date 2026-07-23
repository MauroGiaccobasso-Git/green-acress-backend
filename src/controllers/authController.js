// Importa la lógica de autenticación desde la capa service.
// El controller delega toda la lógica de negocio al service.
import {
  loginUsuario,
  cerrarSesion,
  cambiarPasswordUsuario,
} from "../services/authService.js";

// Importa el wrapper reutilizable para manejo automático de errores async.
// Permite evitar bloques try/catch repetidos en controllers.
import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   LOGIN
========================================================= */

// Controller de login.
// Se encarga únicamente de recibir datos y delegar al service.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const resultado = await loginUsuario(
    email,
    password,
  );

  return res.status(200).json(resultado);
});

/* =========================================================
   CAMBIO DE PASSWORD
========================================================= */

// Permite cambiar una contraseña temporal por una definitiva.
//
// Este endpoint no requiere JWT porque el usuario todavía
// no posee acceso completo al sistema.
//
// La validación de:
// - contraseña actual;
// - contraseña nueva;
// - expiración;
// - actualización de flags;
//
// pertenece exclusivamente al service.
export const cambiarPassword = asyncHandler(async (req, res) => {
  const {
    email,
    passwordActual,
    nuevaPassword,
  } = req.body;

  const resultado = await cambiarPasswordUsuario(
    email,
    passwordActual,
    nuevaPassword,
  );

  return res.status(200).json(resultado);
});

/* =========================================================
   LOGOUT
========================================================= */

// Cierra la sesión incrementando la versión del usuario.
// Esto invalida automáticamente todos los JWT anteriores.
export const logout = asyncHandler(async (req, res) => {
  const resultado = await cerrarSesion(
    req.usuario.id,
  );

  return res.status(200).json(resultado);
});