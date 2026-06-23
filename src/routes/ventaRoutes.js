import express from "express";

import {
  getVentasController,
  getVentaPorIdController,
  registrarVentaController,
  anularVentaController,
} from "../controllers/ventaController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
  Rutas administrativas de ventas.

  Todas las operaciones de este módulo requieren:
  1. Usuario autenticado mediante JWT.
  2. Rol ADMIN, ya que los socios no registran ventas.
*/
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getVentasController,
);

router.get(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  getVentaPorIdController,
);

router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  registrarVentaController,
);

router.patch(
  "/:id/anular",
  verificarToken,
  autorizarRoles("ADMIN"),
  anularVentaController,
);

export default router;