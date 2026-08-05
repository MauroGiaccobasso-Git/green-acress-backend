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
   HELPERS DE RESPUESTA
========================================================= */

// Define el mensaje funcional según el resultado automático
// obtenido luego de procesar la solicitud del socio.
const obtenerMensajeSolicitudReserva = (estado) => {
  if (estado === "CONFIRMADA") {
    return "Reserva confirmada correctamente";
  }

  if (estado === "RECHAZADA") {
    return "La reserva fue rechazada porque no cumplió las condiciones requeridas";
  }

  return "La solicitud de reserva fue registrada correctamente";
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta las reservas registradas aplicando los filtros administrativos.
export const listarReservas = asyncHandler(async (req, res) => {
  const reservas = await getReservas(req.query);

  return res.status(200).json({
    success: true,
    data: reservas,
  });
});

// Obtiene el detalle administrativo completo de una reserva.
export const obtenerReserva = asyncHandler(async (req, res) => {
  const reserva = await getReservaPorId(req.params.id);

  return res.status(200).json({
    success: true,
    data: reserva,
  });
});

/* =========================================================
   CONSULTAS DEL PORTAL DE SOCIOS
========================================================= */

// Obtiene únicamente las reservas pertenecientes al socio autenticado.
// El service separa las reservas activas de su historial personal.
export const listarMisReservas = asyncHandler(async (req, res) => {
  const reservas = await getReservasPorUsuarioSocio(
    req.usuario.id,
    req.query,
  );

  return res.status(200).json({
    success: true,
    data: reservas,
  });
});

// Obtiene una reserva específica verificando que pertenezca
// al socio autenticado.
export const obtenerMiReserva = asyncHandler(async (req, res) => {
  const reserva = await getReservaPorIdUsuarioSocio(
    req.usuario.id,
    req.params.id,
  );

  return res.status(200).json({
    success: true,
    data: reserva,
  });
});

/* =========================================================
   OPERACIONES DEL PORTAL DE SOCIOS
========================================================= */

// Registra y procesa automáticamente una nueva solicitud de reserva.
export const crearReserva = asyncHandler(async (req, res) => {
  const reserva = await solicitarReserva({
    usuarioId: req.usuario.id,
    detalles: req.body.detalles,
    observaciones: req.body.observaciones,
  });

  return res.status(201).json({
    success: true,
    message: obtenerMensajeSolicitudReserva(reserva.estado),
    data: reserva,
  });
});

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Cancela una reserva confirmada y libera el stock comprometido.
export const cancelarReservaAdmin = asyncHandler(async (req, res) => {
  const reserva = await cancelarReserva({
    reservaId: req.params.id,
    usuarioId: req.usuario.id,
    observaciones: req.body.observaciones,
  });

  return res.status(200).json({
    success: true,
    message: "Reserva cancelada correctamente",
    data: reserva,
  });
});

// Registra el retiro presencial de una reserva confirmada.
// La operación la convierte en venta, consume el stock reservado
// y finaliza su ciclo de vida.
export const confirmarRetiroReservaAdmin = asyncHandler(async (req, res) => {
  const reserva = await confirmarRetiroReserva({
    reservaId: req.params.id,
    usuarioId: req.usuario.id,
    observaciones: req.body.observaciones,
  });

  return res.status(200).json({
    success: true,
    message:
      "Retiro registrado correctamente. La reserva fue convertida en venta.",
    data: reserva,
  });
});