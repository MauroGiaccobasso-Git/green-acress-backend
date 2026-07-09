import {
  cancelarReserva,
  getReservaPorId,
  getReservaPorIdUsuarioSocio,
  getReservas,
  getReservasPorUsuarioSocio,
  solicitarReserva,
} from "../services/reservaService.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const listarReservas = async (req, res) => {
  const reservas = await getReservas(req.query);

  res.json({
    success: true,
    data: reservas,
  });
};

export const obtenerReserva = async (req, res) => {
  const reserva = await getReservaPorId(req.params.id);

  res.json({
    success: true,
    data: reserva,
  });
};

/* =========================================================
   CONSULTAS DEL SOCIO
========================================================= */

export const listarMisReservas = async (req, res) => {
  const reservas = await getReservasPorUsuarioSocio(req.usuario.id, req.query);

  res.json({
    success: true,
    data: reservas,
  });
};

export const obtenerMiReserva = async (req, res) => {
  const reserva = await getReservaPorIdUsuarioSocio(
    req.usuario.id,
    req.params.id,
  );

  res.json({
    success: true,
    data: reserva,
  });
};

/* =========================================================
   OPERACIONES DEL MÓDULO
========================================================= */

export const crearReserva = async (req, res) => {
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
};

export const cancelarReservaAdmin = async (req, res) => {
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
};