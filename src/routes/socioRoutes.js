import express from "express";
import {
  aceptarConsentimientoSocio,
  actualizarSocioController,
  cambiarEstadoSocioController,
  crearSocioController,
  getSocioPorIdController,
  getSociosController,
  obtenerPerfilSocioController,
} from "../controllers/socioController.js";
import {
  autorizarRoles,
  verificarConsentimientoSocio,
  verificarToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta socios con búsqueda, filtros y paginación.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getSociosController,
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra un nuevo socio y su usuario asociado.
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  crearSocioController,
);

/* =========================================================
   PERFIL Y CONSENTIMIENTO
========================================================= */

/*
  Las rutas estáticas deben declararse antes de "/:id"
  para evitar que Express interprete sus nombres como identificadores.
*/

// Consulta el perfil del socio autenticado.
// Solo está disponible cuando el consentimiento informado ya fue aceptado.
router.get(
  "/perfil",
  verificarToken,
  autorizarRoles("SOCIO"),
  verificarConsentimientoSocio,
  obtenerPerfilSocioController,
);

// Registra la aceptación del consentimiento informado.
// Debe permanecer accesible incluso si el socio todavía
// no aceptó el consentimiento, ya que es el único endpoint
// que le permite habilitar el acceso al Portal.
router.patch(
  "/consentimiento",
  verificarToken,
  autorizarRoles("SOCIO"),
  aceptarConsentimientoSocio,
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS POR SOCIO
========================================================= */

// Consulta el detalle administrativo de un socio.
router.get(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  getSocioPorIdController,
);

// Actualiza los datos de un socio existente.
router.put(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarSocioController,
);

// Cambia el estado del socio y sincroniza el acceso de su usuario.
router.patch(
  "/:id/estado",
  verificarToken,
  autorizarRoles("ADMIN"),
  cambiarEstadoSocioController,
);

export default router;