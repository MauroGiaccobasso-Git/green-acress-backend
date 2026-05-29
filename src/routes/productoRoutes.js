// Importa Express para crear las rutas del módulo
import express from "express";

// Importa los controladores del módulo de productos
import {
  getProductosController,
  crearProductoController,
  actualizarProductoController,
  actualizarEstadoProductoController,
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
  crearProductoController,
);

// Ruta protegida para actualizar productos existentes.
// Solo los usuarios con rol ADMIN pueden modificar productos.
router.put(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarProductoController,
);

// Ruta protegida para cambiar el estado lógico de un producto.
// Permite activar o desactivar productos sin eliminarlos físicamente.
router.patch(
  "/:id/estado",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarEstadoProductoController,
);

// Exporta el router para utilizarlo en app.js
export default router;
