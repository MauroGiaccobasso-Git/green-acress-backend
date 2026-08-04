import {
  generarRecomendacionesDashboard,
  obtenerDashboardAdministrativo,
} from "../services/dashboardService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONSULTA DEL DASHBOARD ADMINISTRATIVO
========================================================= */

// Obtiene los indicadores, alertas y productos más demandados
// que componen el panel principal del administrador.
export const getDashboardController = asyncHandler(
  async (_req, res) => {
    const dashboard =
      await obtenerDashboardAdministrativo();

    return res.status(200).json({
      message:
        "Dashboard administrativo obtenido correctamente",
      dashboard,
    });
  },
);

/* =========================================================
   RECOMENDACIONES INTELIGENTES
========================================================= */

// Genera recomendaciones informativas utilizando únicamente
// métricas agregadas calculadas por el backend.
export const generarRecomendacionesDashboardController =
  asyncHandler(async (_req, res) => {
    const resultado =
      await generarRecomendacionesDashboard();

    return res.status(200).json({
      message:
        "Recomendaciones inteligentes generadas correctamente",
      recomendaciones: resultado.recomendaciones,
      generatedAt: resultado.generatedAt,
    });
  });