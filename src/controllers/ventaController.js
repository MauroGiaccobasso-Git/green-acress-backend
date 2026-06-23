import {
  getVentas,
  getVentaPorId,
  registrarVenta,
  anularVenta,
} from "../services/ventaService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONTROLADORES DE VENTAS
========================================================= */

// Lista ventas registradas para consulta administrativa.
export const getVentasController = asyncHandler(async (req, res) => {
  const ventas = await getVentas({
    search: req.query.search,
    estado: req.query.estado,
    socioId: req.query.socio_id,
  });

  return res.status(200).json({
    message: "Ventas obtenidas correctamente",
    ventas,
  });
});

// Obtiene el detalle completo de una venta.
export const getVentaPorIdController = asyncHandler(async (req, res) => {
  const venta = await getVentaPorId(req.params.id);

  return res.status(200).json({
    message: "Venta obtenida correctamente",
    venta,
  });
});

// Registra una venta presencial realizada por un administrador.
export const registrarVentaController = asyncHandler(async (req, res) => {
  const venta = await registrarVenta({
    socioId: req.body.socio_id,
    usuarioId: req.usuario.id,
    detalles: req.body.detalles,
    observaciones: req.body.observaciones,
  });

  return res.status(201).json({
    message: "Venta registrada correctamente",
    venta,
  });
});

// Anula una venta registrada sin eliminar su información histórica.
export const anularVentaController = asyncHandler(async (req, res) => {
  const venta = await anularVenta({
    ventaId: req.params.id,
    usuarioId: req.usuario.id,
  });

  return res.status(200).json({
    message: "Venta anulada correctamente",
    venta,
  });
});