import express from "express";

import {
  getNovedadesController,
  getNovedadPorIdController,
  crearNovedadController,
  cambiarEstadoNovedadController,
} from "../controllers/novedadController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";


const router = express.Router();


/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta todas las novedades administrativas.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getNovedadesController,
);


// Consulta el detalle administrativo de una novedad.
router.get(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  getNovedadPorIdController,
);


/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Crea una nueva novedad.
// La publicación es inmediata y genera notificaciones.
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  crearNovedadController,
);


// Cambia el estado administrativo de una novedad.
router.patch(
  "/:id/estado",
  verificarToken,
  autorizarRoles("ADMIN"),
  cambiarEstadoNovedadController,
);


export default router;