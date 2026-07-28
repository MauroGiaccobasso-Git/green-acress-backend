import express from "express";
import {
  login,
  verificarMfa,
  verificarMfaRecuperacion,
  logout,
  cambiarPassword,
  solicitarRecuperacion,
  restablecerPassword,
} from "../controllers/authController.js";
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/* =========================================================
   AUTENTICACIÓN
========================================================= */

router.post("/login", login);

/*
  Completa el segundo factor de autenticación MFA.

  Se utiliza únicamente después de un login correcto
  cuando un ADMIN tiene MFA habilitado.

  No requiere token porque todavía no existe
  una sesión JWT definitiva.
*/
router.post("/verificar-mfa", verificarMfa);

/*
  Completa el segundo factor de autenticación MFA
  utilizando un código de recuperación.

  Se utiliza únicamente cuando:
  - el login fue correcto;
  - el usuario ADMIN tiene MFA habilitado;
  - el usuario perdió acceso a la aplicación autenticadora.

  Los códigos de recuperación son llaves de emergencia
  de un solo uso.

  No requiere token porque todavía no existe
  una sesión JWT definitiva.
*/
router.post("/verificar-mfa-recuperacion", verificarMfaRecuperacion);

/*
  Permite cambiar la contraseña temporal por una definitiva.

  No requiere token porque el usuario todavía no tiene
  acceso completo al sistema hasta finalizar este proceso.
*/
router.post("/cambiar-password", cambiarPassword);

/*
  Inicia el proceso de recuperación de contraseña.

  Siempre devuelve la misma respuesta para evitar revelar
  si un correo electrónico existe en el sistema.
*/
router.post("/recuperar-password", solicitarRecuperacion);

/*
  Restablece la contraseña utilizando un token de recuperación.

  No requiere autenticación porque el usuario todavía
  no dispone de una sesión válida.
*/
router.post("/restablecer-password", restablecerPassword);

/*
  Cierra la sesión actual.

  Necesita un token válido porque utiliza req.usuario.id
  para incrementar la versión de sesión en la base de datos.
*/
router.post("/logout", verificarToken, logout);

/* =========================================================
   RUTAS DE PRUEBA
========================================================= */

// Ruta protegida de prueba.
router.get("/perfil", verificarToken, (req, res) => {
  res.json({
    message: "Acceso autorizado",
    usuario: req.usuario,
  });
});

// Ruta protegida de prueba solo para administradores.
router.get("/admin", verificarToken, autorizarRoles("ADMIN"), (req, res) => {
  res.json({
    message: "Acceso autorizado para administrador",
    usuario: req.usuario,
  });
});

export default router;
