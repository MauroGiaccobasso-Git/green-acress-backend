import express from "express";

import {
  getProductosController,
  getOpcionesProductosVentaController,
  getOpcionesProductosCompraController,
  getProductosPortalSocioController,
  crearProductoController,
  actualizarProductoController,
  actualizarEstadoProductoController,
} from "../controllers/productoController.js";

import {
  verificarToken,
  autorizarRoles,
  verificarConsentimientoSocio,
} from "../middlewares/authMiddleware.js";
import { recibirImagenProducto } from "../middlewares/productImageUploadMiddleware.js";

const router = express.Router();

/* =========================================================
   CONSULTAS DEL PORTAL DE SOCIOS
========================================================= */

// Consulta las flores disponibles para reserva desde el Portal de Socios.
// Los socios ACTIVO e INACTIVO pueden consultar el catálogo.
// Requiere consentimiento informado previamente aceptado.
router.get(
  "/disponibles",
  verificarToken,
  autorizarRoles("SOCIO"),
  verificarConsentimientoSocio,
  getProductosPortalSocioController,
);

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta productos con búsqueda, filtros y paginación administrativa.
router.get(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  getProductosController,
);

/* =========================================================
   CONSULTAS OPERATIVAS
========================================================= */

// Obtiene las flores habilitadas para el registro administrativo de ventas.
router.get(
  "/opciones-venta",
  verificarToken,
  autorizarRoles("ADMIN"),
  getOpcionesProductosVentaController,
);

// Obtiene las semillas utilizadas por el formulario administrativo de compras.
router.get(
  "/opciones-compra",
  verificarToken,
  autorizarRoles("ADMIN"),
  getOpcionesProductosCompraController,
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra un nuevo producto y procesa opcionalmente su imagen.
router.post(
  "/",
  verificarToken,
  autorizarRoles("ADMIN"),
  recibirImagenProducto,
  crearProductoController,
);

// Actualiza los datos editables de un producto
// y permite reemplazar opcionalmente su imagen.
router.put(
  "/:id",
  verificarToken,
  autorizarRoles("ADMIN"),
  recibirImagenProducto,
  actualizarProductoController,
);

// Modifica el estado lógico de un producto existente.
router.patch(
  "/:id/estado",
  verificarToken,
  autorizarRoles("ADMIN"),
  actualizarEstadoProductoController,
);

export default router;
