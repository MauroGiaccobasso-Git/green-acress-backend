import { asyncHandler } from "../utils/asyncHandler.js";
import {
  cancelarReserva,
  confirmarRetiroReserva,
  getReservaPorId,
  getReservaPorIdUsuarioSocio,
  getReservas,
  getReservasPorUsuarioSocio,
  solicitarReserva,
} from "../services/reservaService.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const listarReservas = asyncHandler(async (req, res) => {
  const reservas = await getReservas(req.query);

  res.json({
    success: true,
    data: reservas,
  });
});

export const obtenerReserva = asyncHandler(async (req, res) => {
  const reserva = await getReservaPorId(req.params.id);

  res.json({
    success: true,
    data: reserva,
  });
});

/* =========================================================
   CONSULTAS DEL SOCIO
========================================================= */

export const listarMisReservas = asyncHandler(async (req, res) => {
  const reservas = await getReservasPorUsuarioSocio(req.usuario.id, req.query);

  res.json({
    success: true,
    data: reservas,
  });
});

export const obtenerMiReserva = asyncHandler(async (req, res) => {
  const reserva = await getReservaPorIdUsuarioSocio(
    req.usuario.id,
    req.params.id,
  );

  res.json({
    success: true,
    data: reserva,
  });
});

/* =========================================================
   OPERACIONES DEL MÓDULO
========================================================= */

export const crearReserva = asyncHandler(async (req, res) => {
  const reserva = await solicitarReserva({
    usuarioId: req.usuario.id,
    detalles: req.body.detalles,
    observaciones: req.body.observaciones,
  });

  const message =
    reserva.estado === "CONFIRMADA"
      ? "Reserva confirmada correctamente"
      : "La solicitud de reserva fue registrada y procesada. El resultado final fue RECHAZADA.";

  res.status(201).json({
    success: true,
    message,
    data: reserva,
  });
});

export const cancelarReservaAdmin = asyncHandler(async (req, res) => {
  const reserva = await cancelarReserva({
    reservaId: req.params.id,
    usuarioId: req.usuario.id,
    observaciones: req.body.observaciones,
  });

  res.json({
    success: true,
    message: "Reserva cancelada correctamente",
    data: reserva,
  });
});

// Registra el retiro presencial de una reserva previamente confirmada.
// La operación convierte automáticamente la reserva en una venta,
// consume el stock reservado y finaliza el ciclo de vida de la reserva.
export const confirmarRetiroReservaAdmin = asyncHandler(async (req, res) => {
  const reserva = await confirmarRetiroReserva({
    reservaId: req.params.id,
    usuarioId: req.usuario.id,
  });

  res.json({
    success: true,
    message:
      "Retiro registrado correctamente. La reserva fue convertida en venta.",
    data: reserva,
  });
});