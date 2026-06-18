import express from "express";
import { registrarCompraController } from "../controllers/compraController.js";
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
  Rutas administrativas de compras.

  Todas las operaciones de este módulo requieren:
  1. Usuario autenticado mediante JWT.
  2. Rol ADMIN, ya que los socios no registran compras.
*/
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  registrarCompraController,
);

export default router;