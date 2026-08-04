import express from "express";

import {
  generarRecomendacionesDashboardController,
  getDashboardController,
} from "../controllers/dashboardController.js";

import {
  autorizarRoles,
  verificarToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/* =========================================================
   DASHBOARD ADMINISTRATIVO
========================================================= */

// Obtiene los indicadores, alertas operativas y productos
// más demandados del panel principal del administrador.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getDashboardController,
);

// Genera recomendaciones inteligentes de reposición
// utilizando exclusivamente métricas agregadas del sistema.
router.post(
  "/recommendations",
  verificarToken,
  autorizarRoles("ADMIN"),
  generarRecomendacionesDashboardController,
);

export default router;