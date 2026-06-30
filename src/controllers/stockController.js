import {
  getInventario,
  getMovimientosStock,
  ajustarStock,
} from "../services/stockService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONTROLADORES DE STOCK
========================================================= */

// Lista el inventario actual para consulta administrativa.
export const getInventarioController = asyncHandler(async (req, res) => {
  const inventario = await getInventario({
    search: req.query.search,   
    tipo: req.query.tipo,
    estado: req.query.estado,
  });

  return res.status(200).json({
    message: "Inventario obtenido correctamente",
    inventario,
  });
});

// Lista los movimientos de stock para trazabilidad administrativa.
export const getMovimientosStockController = asyncHandler(async (req, res) => {
  const movimientos = await getMovimientosStock({
    search: req.query.search,
    tipo: req.query.tipo,
    referenciaTipo: req.query.referencia_tipo,
    productoId: req.query.producto_id,
    fechaDesde: req.query.fecha_desde,
    fechaHasta: req.query.fecha_hasta,
  });

  return res.status(200).json({
    message: "Movimientos de stock obtenidos correctamente",
    movimientos,
  });
});

// Realiza un ajuste manual de stock sobre un producto.
export const ajustarStockController = asyncHandler(async (req, res) => {
  const stock = await ajustarStock({
    productoId: req.params.productoId,
    nuevaCantidadTotal: req.body.nueva_cantidad_total,
    observaciones: req.body.observaciones,
  });

  return res.status(200).json({
    message: "Stock ajustado correctamente",
    stock,
  });
});