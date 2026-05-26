import {
  obtenerProductos,
  crearProducto,
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
