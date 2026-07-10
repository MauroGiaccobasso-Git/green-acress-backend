import {
  getProductos,
  crearProducto,
  actualizarProducto,
  actualizarEstadoProducto,
} from "../services/productoService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

// Obtiene productos registrados permitiendo aplicar búsqueda, filtros y paginación administrativa.
export const getProductosController = asyncHandler(async (req, res) => {
  // Obtiene filtros opcionales enviados mediante query params.
  const {
    search = "",
    tipo,
    estado,
    genetica,
    page = 1,
    limit = 10,
  } = req.query;

  // Consulta productos registrados aplicando búsqueda, filtros y paginación.
  const resultado = await getProductos({
    search,
    tipo,
    estado,
    genetica,
    page,
    limit,
  });

  return res.status(200).json(resultado);
});

/**
 * Controller encargado de registrar un nuevo producto.
 */
export const crearProductoController = asyncHandler(async (req, res) => {
  // Envía los datos del producto y el usuario autenticado al service.
  const nuevoProducto = await crearProducto({
    datosProducto: req.body,
    usuarioId: req.usuario.id,
  });

  // Retorna respuesta exitosa con el producto creado.
  return res.status(201).json({
    message: "Producto creado correctamente",
    producto: nuevoProducto,
  });
});

/**
 * Controller encargado de actualizar los datos editables de un producto existente.
 */
export const actualizarProductoController = asyncHandler(async (req, res) => {
  // Envía el identificador, los datos editables y el usuario autenticado al service.
  const productoActualizado = await actualizarProducto({
    productoId: req.params.id,
    datosProducto: req.body,
    usuarioId: req.usuario.id,
  });

  // Retorna respuesta exitosa con el producto actualizado.
  return res.status(200).json({
    message: "Producto actualizado correctamente",
    producto: productoActualizado,
  });
});

// Permite modificar el estado lógico de un producto existente.
export const actualizarEstadoProductoController = asyncHandler(
  async (req, res) => {
    // Envía el identificador, el nuevo estado y el usuario autenticado al service.
    const producto = await actualizarEstadoProducto({
      productoId: req.params.id,
      nuevoEstado: req.body.estado,
      usuarioId: req.usuario.id,
    });

    // Retorna respuesta exitosa con el producto actualizado.
    return res.status(200).json({
      message: "Estado del producto actualizado correctamente",
      producto,
    });
  },
);
