// Importa Express para crear las rutas del módulo
import express from "express";

// Importa los controladores del módulo de productos
import {
  getProductosController,
  crearProductoController,
} from "../controllers/productoController.js";

// Importa los middlewares de autenticación y autorización
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

// Crea una instancia del router de Express
const router = express.Router();

// Ruta GET para consultar todos los productos registrados.
// Solo puede acceder un ADMIN autenticado.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getProductosController,
  
);

// Ruta protegida para registrar nuevos productos.
// Solo usuarios ADMIN pueden crear productos.
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  crearProductoController
);

// Exporta el router para utilizarlo en app.js
export default router;
