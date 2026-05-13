// Importa Express para crear las rutas del módulo
import express from "express";

// Importa los controladores del módulo de socios
import {
  getSociosController,
  crearSocioController,
  actualizarSocioController,
  desactivarSocioController,
  obtenerPerfilSocioController,
} from "../controllers/socioController.js";

// Importa los middlewares de autenticación y autorización
import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

// Crea una instancia del router de Express
const router = express.Router();

// Ruta GET para consultar todos los socios registrados.
// Solo puede acceder un ADMIN autenticado.
router.get("/", verificarToken, autorizarRoles("ADMIN"), getSociosController);

// Ruta POST para registrar un nuevo socio.
// Solo puede acceder un ADMIN autenticado.
router.post("/", verificarToken, autorizarRoles("ADMIN"), crearSocioController);

// GET /socios/perfil
//
// Ruta protegida para que un socio autenticado
// consulte únicamente su propio perfil.
//
// IMPORTANTE:
// Esta ruta debe declararse antes de "/:id"
// para evitar conflictos de routing en Express.
router.get(
  "/perfil",
  verificarToken,
  autorizarRoles("SOCIO"),
  obtenerPerfilSocioController,
);

// Ruta PUT para actualizar un socio existente.
// Solo puede acceder un ADMIN autenticado.
router.put(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarSocioController,
);

// Ruta PATCH para desactivar lógicamente un socio.
// No elimina registros de la base de datos.
// Solo cambia el estado a INACTIVO.
router.patch(
  "/:id/desactivar",
  verificarToken,
  autorizarRoles("ADMIN"),
  desactivarSocioController,
);

// Exporta el router para utilizarlo en app.js
export default router;
