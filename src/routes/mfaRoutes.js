import express from "express";

import {
  configurarMfa,
  confirmarMfa,
} from "../controllers/mfaController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";


const router = express.Router();


/* =========================================================
   CONFIGURACIÓN MFA
========================================================= */

/*
  Solo administradores autenticados pueden iniciar
  la configuración MFA.
*/
router.post(
  "/configurar",
  verificarToken,
  autorizarRoles("ADMIN"),
  configurarMfa,
);


/* =========================================================
   CONFIRMAR MFA
========================================================= */

/*
  Valida el código generado por la aplicación autenticadora
  y activa MFA definitivamente.
*/
router.post(
  "/confirmar",
  verificarToken,
  autorizarRoles("ADMIN"),
  confirmarMfa,
);


export default router;