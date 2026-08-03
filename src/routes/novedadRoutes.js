import express from "express";

import {
  cambiarEstadoNovedadController,
  crearNovedadController,
  getNovedadPorIdController,
  getNovedadesActivasController,
  getNovedadesController,
} from "../controllers/novedadController.js";

import {
  autorizarRoles,
  verificarConsentimientoSocio,
  verificarToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/* =========================================================
   CONSULTAS DEL SOCIO
========================================================= */

// Consulta únicamente las novedades activas para el Portal de Socios.
// Requiere autenticación, rol SOCIO y consentimiento informado aceptado.
router.get(
  "/activas",
  verificarToken,
  autorizarRoles("SOCIO"),
  verificarConsentimientoSocio,
  getNovedadesActivasController,
);

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta las novedades administrativas.
// Admite búsqueda por título o contenido y filtro por estado.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getNovedadesController,
);

// Consulta el detalle administrativo de una novedad.
// Debe permanecer después de las rutas estáticas.
router.get(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  getNovedadPorIdController,
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Crea y publica inmediatamente una novedad en estado ACTIVA.
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  crearNovedadController,
);

// Cambia exclusivamente el estado entre ACTIVA e INACTIVA.
router.patch(
  "/:id/estado",
  verificarToken,
  autorizarRoles("ADMIN"),
  cambiarEstadoNovedadController,
);

export default router;