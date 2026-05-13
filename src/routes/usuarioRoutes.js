// Importa el framework Express.
// Express permite definir rutas HTTP y manejar solicitudes del cliente.
import express from "express";

// Importa el controlador que contiene la lógica para manejar la request.
import { getUsuariosController } from "../controllers/usuarioController.js";

// Importa los middlewares de autenticación y autorización.
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

// Crea una instancia de Router de Express.
const router = express.Router();

// GET /usuarios
//
// Ruta protegida para administración de usuarios.
//
// Flujo:
// 1. Verifica que exista un token válido.
// 2. Verifica que el usuario tenga rol ADMIN.
// 3. Ejecuta el controller.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getUsuariosController
);

// Exporta el router.
export default router;