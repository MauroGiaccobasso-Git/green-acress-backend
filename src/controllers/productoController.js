import {
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  desactivarProducto,
} from "../services/productoService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

// Controller encargado de obtener todos los productos registrados.
export const getProductosController = asyncHandler(async (req, res) => {
  const productos = await obtenerProductos();

  return res.status(200).json(productos);
});

/**
 * Controller encargado de registrar un nuevo producto.
 */
export const crearProductoController = asyncHandler(async (req, res) => {
  // Envía los datos recibidos al service.
  const nuevoProducto = await crearProducto(req.body);

  // Retorna respuesta exitosa con el producto creado.
  return res.status(201).json({
    message: "Producto creado correctamente",
    producto: nuevoProducto,
  });
});

export const actualizarProductoController = asyncHandler(async (req, res) => {
  const productoActualizado = await actualizarProducto(req.params.id, req.body);

  res.status(200).json({
    message: "Producto actualizado correctamente",
    producto: productoActualizado,
  });
});

export const desactivarProductoController = asyncHandler(async (req, res) => {
  const producto = await desactivarProducto(req.params.id);

  res.status(200).json({
    message: "Producto desactivado correctamente",
    producto,
  });
});