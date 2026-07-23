import express from "express";
import {
  login,
  logout,
  cambiarPassword,
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
  Permite cambiar la contraseña temporal por una definitiva.

  No requiere token porque el usuario todavía no tiene
  acceso completo al sistema hasta finalizar este proceso.
*/
router.post("/cambiar-password", cambiarPassword);

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