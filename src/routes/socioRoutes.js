// Importa Express para crear las rutas del módulo
import express from "express";

// Importa los controladores del módulo de socios
import {
  getSociosController,
  crearSocioController,
  actualizarSocioController,
  desactivarSocioController
} from "../controllers/socioController.js";

// Importa los middlewares de autenticación y autorización
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

// Crea una instancia del router de Express
const router = express.Router();

// Ruta GET para consultar socios
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getSociosController
);

// Ruta POST para registrar un nuevo socio
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  crearSocioController
);
router.put(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarSocioController
);

// Ruta PATCH para desactivar un socio lógicamente
router.patch(
  "/:id/desactivar",
  verificarToken,
  autorizarRoles("ADMIN"),
  desactivarSocioController
);



// Exporta el router para utilizarlo en app.js
export default router;