// Importa la lógica de autenticación desde la capa service.
// El controller delega toda la lógica de negocio al service.
import {
  loginUsuario,
  verificarMfaLoginUsuario,
  verificarMfaRecuperacionLoginUsuario,
  cerrarSesion,
  cambiarPasswordUsuario,
  solicitarRecuperacionPassword,
  restablecerPasswordUsuario,
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
  const {
    email,
    password,
  } = req.body;


  const resultado =
    await loginUsuario(
      email,
      password,
    );


  return res.status(200).json(resultado);
});


/* =========================================================
   VERIFICACIÓN MFA
========================================================= */

// Completa el segundo factor de autenticación.
//
// Este endpoint se ejecuta únicamente cuando:
// - el login fue correcto;
// - el usuario ADMIN tiene MFA habilitado;
// - el service devolvió requiereMfa=true.
//
// Recibe:
// - usuarioId;
// - código TOTP generado por la aplicación autenticadora.
export const verificarMfa = asyncHandler(
  async (req, res) => {

    const {
      usuarioId,
      codigo,
    } = req.body;


    const resultado =
      await verificarMfaLoginUsuario(
        usuarioId,
        codigo,
      );


    return res.status(200).json(resultado);
  },
);


/* =========================================================
   VERIFICACIÓN MFA MEDIANTE CÓDIGO DE RECUPERACIÓN
========================================================= */

// Completa el segundo factor utilizando un código
// de recuperación MFA.
//
// Este flujo se utiliza únicamente cuando:
// - el login fue correcto;
// - el usuario ADMIN tiene MFA habilitado;
// - el usuario no dispone del código TOTP generado
//   por su aplicación autenticadora.
//
// Los códigos de recuperación funcionan como llaves
// de emergencia de un solo uso.
//
// Recibe:
// - usuarioId;
// - código de recuperación MFA.
export const verificarMfaRecuperacion = asyncHandler(
  async (req, res) => {

    const {
      usuarioId,
      codigo,
    } = req.body;


    const resultado =
      await verificarMfaRecuperacionLoginUsuario(
        usuarioId,
        codigo,
      );


    return res.status(200).json(resultado);
  },
);


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
export const cambiarPassword = asyncHandler(
  async (req, res) => {

    const {
      email,
      passwordActual,
      nuevaPassword,
    } = req.body;


    const resultado =
      await cambiarPasswordUsuario(
        email,
        passwordActual,
        nuevaPassword,
      );


    return res.status(200).json(resultado);
  },
);


/* =========================================================
   RECUPERACIÓN DE PASSWORD
========================================================= */

// Inicia el proceso de recuperación de contraseña.
//
// Devuelve siempre una respuesta genérica para evitar revelar
// si el correo electrónico está registrado en el sistema.
export const solicitarRecuperacion = asyncHandler(
  async (req, res) => {

    const {
      email,
    } = req.body;


    const resultado =
      await solicitarRecuperacionPassword(
        email,
      );


    return res.status(200).json(resultado);
  },
);


// Restablece la contraseña utilizando un token de recuperación.
//
// La validación del token, expiración, uso único,
// política de contraseña e invalidación de sesiones
// pertenece exclusivamente al service.
export const restablecerPassword = asyncHandler(
  async (req, res) => {

    const {
      token,
      nuevaPassword,
    } = req.body;


    const resultado =
      await restablecerPasswordUsuario(
        token,
        nuevaPassword,
      );


    return res.status(200).json(resultado);
  },
);


/* =========================================================
   LOGOUT
========================================================= */

// Cierra la sesión incrementando la versión del usuario.
// Esto invalida automáticamente todos los JWT anteriores.
export const logout = asyncHandler(
  async (req, res) => {

    const resultado =
      await cerrarSesion(
        req.usuario.id,
      );


    return res.status(200).json(resultado);
  },
);