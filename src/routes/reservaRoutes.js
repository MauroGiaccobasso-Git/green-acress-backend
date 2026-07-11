import express from "express";

import {
  cancelarReservaAdmin,
  confirmarRetiroReservaAdmin,
  crearReserva,
  listarMisReservas,
  listarReservas,
  obtenerMiReserva,
  obtenerReserva,
} from "../controllers/reservaController.js";

import {
  verificarToken,
  autorizarRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
  Rutas del módulo de reservas.

  El módulo contempla dos flujos:
  1. Socios autenticados: solicitan y consultan sus propias reservas.
  2. Administradores: consultan, administran y completan el ciclo de vida
     de las reservas mediante acciones de negocio.

  El procesamiento automático de confirmaciones, rechazos y vencimientos
  se encuentra centralizado en el service y es ejecutado por procesos internos
  del sistema (cron jobs), sin intervención manual de un administrador.
*/

// Rutas del socio.
router.get(
  "/mis-reservas",
  verificarToken,
  autorizarRoles("SOCIO"),
  listarMisReservas,
);

router.get(
  "/mis-reservas/:id",
  verificarToken,
  autorizarRoles("SOCIO"),
  obtenerMiReserva,
);

router.post("/", verificarToken, autorizarRoles("SOCIO"), crearReserva);

// Rutas administrativas.
router.get("/", verificarToken, autorizarRoles("ADMIN"), listarReservas);

router.get("/:id", verificarToken, autorizarRoles("ADMIN"), obtenerReserva);

router.patch(
  "/:id/cancelar",
  verificarToken,
  autorizarRoles("ADMIN"),
  cancelarReservaAdmin,
);

// Registra el retiro presencial de una reserva previamente confirmada.
// La operación convierte automáticamente la reserva en una venta y
// completa su ciclo de vida funcional.
router.patch(
  "/:id/confirmar-retiro",
  verificarToken,
  autorizarRoles("ADMIN"),
  confirmarRetiroReservaAdmin,
);

export default router;