import express from "express";

import {
  getProveedoresController,
  crearProveedorController,
  actualizarProveedorController,
  actualizarEstadoProveedorController,
} from "../controllers/proveedorController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

// Middlewares reutilizables para operaciones administrativas.
const adminMiddleware = [verificarToken, autorizarRoles("ADMIN")];

// Consulta proveedores registrados con búsqueda opcional.
router.get("/", ...adminMiddleware, getProveedoresController);

// Registra un nuevo proveedor.
router.post("/", ...adminMiddleware, crearProveedorController);

// Actualiza información de un proveedor existente.
router.put("/:id", ...adminMiddleware, actualizarProveedorController);

// Actualiza lógicamente el estado de un proveedor.
router.patch(
  "/:id/estado",
  ...adminMiddleware,
  actualizarEstadoProveedorController,
);

export default router;
