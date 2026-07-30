import express from "express";

import {
  configurarMfa,
  confirmarMfa,
  desactivarMfa,
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


/* =========================================================
   DESACTIVAR MFA
========================================================= */

/*
  Permite desactivar MFA únicamente a administradores
  autenticados.

  Requiere confirmación adicional mediante:
  - contraseña actual;
  - código TOTP vigente.

  La eliminación de secretos y códigos de recuperación,
  junto con la auditoría correspondiente, pertenece
  exclusivamente al service.
*/
router.post(
  "/desactivar",
  verificarToken,
  autorizarRoles("ADMIN"),
  desactivarMfa,
);


export default router;