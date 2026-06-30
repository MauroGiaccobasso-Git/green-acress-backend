import express from "express";

import {
  getInventarioController,
  getMovimientosStockController,
  ajustarStockController,
} from "../controllers/stockController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
  Rutas administrativas de stock.

  Todas las operaciones de este módulo requieren:
  1. Usuario autenticado mediante JWT.
  2. Rol ADMIN, ya que únicamente los administradores
     pueden consultar el inventario y realizar ajustes.
*/

router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getInventarioController,
);

router.get(
  "/movimientos",
  verificarToken,
  autorizarRoles("ADMIN"),
  getMovimientosStockController,
);

router.patch(
  "/:productoId/ajuste",
  verificarToken,
  autorizarRoles("ADMIN"),
  ajustarStockController,
);

export default router;