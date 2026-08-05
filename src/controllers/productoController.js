import {
  getProductos,
  getOpcionesProductosVenta,
  getOpcionesProductosCompra,
  getProductosPortalSocio,
  crearProducto,
  actualizarProducto,
  actualizarEstadoProducto,
} from "../services/productoService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Obtiene productos registrados permitiendo aplicar búsqueda,
// filtros y paginación administrativa.
export const getProductosController = asyncHandler(async (req, res) => {
  const {
    search = "",
    tipo,
    estado,
    genetica,
    page = 1,
    limit = 10,
  } = req.query;

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

/* =========================================================
   CONSULTAS OPERATIVAS
========================================================= */

// Obtiene las opciones de productos disponibles para registrar ventas.
export const getOpcionesProductosVentaController = asyncHandler(
  async (req, res) => {
    const productos = await getOpcionesProductosVenta();

    return res.status(200).json({
      message: "Opciones de productos para ventas obtenidas correctamente",
      productos,
    });
  },
);

// Obtiene las opciones de productos disponibles para registrar compras.
export const getOpcionesProductosCompraController = asyncHandler(
  async (req, res) => {
    const productos = await getOpcionesProductosCompra();

    return res.status(200).json({
      message: "Opciones de productos para compras obtenidas correctamente",
      productos,
    });
  },
);

/* =========================================================
   CONSULTAS DEL PORTAL DE SOCIOS
========================================================= */

// Obtiene el catálogo de flores disponibles para reserva dentro
// del Portal de Socios, utilizando un contrato público reducido.
export const getProductosPortalSocioController = asyncHandler(
  async (req, res) => {
    const productos = await getProductosPortalSocio();

    return res.status(200).json({
      message: "Productos disponibles obtenidos correctamente",
      productos,
    });
  },
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra un nuevo producto.
export const crearProductoController = asyncHandler(async (req, res) => {
  const nuevoProducto = await crearProducto({
    datosProducto: req.body,
    usuarioId: req.usuario.id,
  });

  return res.status(201).json({
    message: "Producto creado correctamente",
    producto: nuevoProducto,
  });
});

// Actualiza los datos editables de un producto existente.
export const actualizarProductoController = asyncHandler(async (req, res) => {
  const productoActualizado = await actualizarProducto({
    productoId: req.params.id,
    datosProducto: req.body,
    usuarioId: req.usuario.id,
  });

  return res.status(200).json({
    message: "Producto actualizado correctamente",
    producto: productoActualizado,
  });
});

// Modifica el estado lógico de un producto existente.
export const actualizarEstadoProductoController = asyncHandler(
  async (req, res) => {
    const producto = await actualizarEstadoProducto({
      productoId: req.params.id,
      nuevoEstado: req.body.estado,
      usuarioId: req.usuario.id,
    });

    return res.status(200).json({
      message: "Estado del producto actualizado correctamente",
      producto,
    });
  },
);