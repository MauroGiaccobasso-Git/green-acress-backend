import {
  getResumenStock,
  getInventario,
  getMovimientosStock,
  ajustarStock,
} from "../services/stockService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONTROLADORES DE STOCK
========================================================= */

// Obtiene las métricas globales del inventario para las KPI administrativas.
export const getResumenStockController = asyncHandler(async (req, res) => {
  const resumen = await getResumenStock();

  return res.status(200).json({
    message: "Resumen de stock obtenido correctamente",
    resumen,
  });
});

// Lista el inventario actual para consulta administrativa.
export const getInventarioController = asyncHandler(async (req, res) => {
  const resultado = await getInventario({
    search: req.query.search,
    tipo: req.query.tipo,
    estado: req.query.estado,
    page: req.query.page,
    limit: req.query.limit,
  });

  return res.status(200).json({
    message: "Inventario obtenido correctamente",
    inventario: resultado.data,
    pagination: resultado.pagination,
  });
});

// Lista los movimientos de stock para trazabilidad administrativa.
export const getMovimientosStockController = asyncHandler(async (req, res) => {
  const resultado = await getMovimientosStock({
    search: req.query.search,
    tipo: req.query.tipo,
    referenciaTipo: req.query.referencia_tipo,
    productoId: req.query.producto_id,
    fechaDesde: req.query.fecha_desde,
    fechaHasta: req.query.fecha_hasta,
    page: req.query.page,
    limit: req.query.limit,
  });

  return res.status(200).json({
    message: "Movimientos de stock obtenidos correctamente",
    movimientos: resultado.data,
    pagination: resultado.pagination,
  });
});

// Realiza un ajuste manual de stock sobre un producto.
// El body recibe una variación positiva o negativa, no una cantidad final.
export const ajustarStockController = asyncHandler(async (req, res) => {
  const stock = await ajustarStock({
    productoId: req.params.productoId,
    variacion: req.body.variacion,
    observaciones: req.body.observaciones,
  });

  return res.status(200).json({
    message: "Stock ajustado correctamente",
    stock,
  });
});