import {
  getProductos,
  crearProducto,
  actualizarProducto,
  actualizarEstadoProducto,
} from "../services/productoService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

// Obtiene productos registrados permitiendo aplicar búsqueda opcional para gestión administrativa.
export const getProductosController = asyncHandler(async (req, res) => {
  // Obtiene búsqueda opcional enviada mediante query params.
  const { search } = req.query;

  // Consulta productos registrados aplicando filtro opcional.
  const productos = await getProductos(search);

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

// Permite modificar el estado lógico de un producto existente.
export const actualizarEstadoProductoController = asyncHandler(
  async (req, res) => {
    const producto = await actualizarEstadoProducto(
      req.params.id,
      req.body.estado,
    );

    res.status(200).json({
      message: "Estado del producto actualizado correctamente",
      producto,
    });
  },
);