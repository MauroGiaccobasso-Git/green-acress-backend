import {
  getProductos,
  getOpcionesProductosVenta,
  getOpcionesProductosCompra,
  getProductosPortalSocio,
  crearProducto,
  actualizarProducto,
  actualizarEstadoProducto,
} from "../services/productoService.js";

import {
  eliminarImagenProducto,
  eliminarImagenProductoPorUrl,
  subirImagenProducto,
} from "../services/productImageStorageService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   HELPERS DE IMÁGENES
========================================================= */

// Incorpora la URL de la imagen subida a S3 únicamente cuando
// el formulario incluye un nuevo archivo.
//
// También conserva la clave interna para poder compensar
// la subida si posteriormente falla PostgreSQL.
const construirDatosProductoConImagen = async (datosProducto, archivo) => {
  if (!archivo) {
    return {
      datosProducto,
      imagenSubida: null,
    };
  }

  const imagenSubida = await subirImagenProducto(archivo);

  return {
    datosProducto: {
      ...datosProducto,
      imagen_url: imagenSubida.url,
    },
    imagenSubida,
  };
};

// Elimina una imagen recién subida cuando la operación
// principal del producto no pudo completarse.
const compensarImagenSubida = async (imagenSubida) => {
  if (!imagenSubida?.key) {
    return;
  }

  await eliminarImagenProducto(imagenSubida.key);
};

// Después de una actualización exitosa, elimina la imagen anterior
// únicamente cuando realmente fue reemplazada por una nueva.
const limpiarImagenAnteriorReemplazada = async ({
  imagenSubida,
  imagenAnteriorUrl,
}) => {
  if (!imagenSubida || !imagenAnteriorUrl) {
    return;
  }

  if (imagenAnteriorUrl === imagenSubida.url) {
    return;
  }

  await eliminarImagenProductoPorUrl(imagenAnteriorUrl);
};

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

// Registra un nuevo producto y procesa opcionalmente su imagen.
//
// Si PostgreSQL rechaza la creación, elimina de S3 la imagen
// recién subida para evitar archivos abandonados.
export const crearProductoController = asyncHandler(async (req, res) => {
  const { datosProducto, imagenSubida } =
    await construirDatosProductoConImagen(req.body, req.file);

  try {
    const nuevoProducto = await crearProducto({
      datosProducto,
      usuarioId: req.usuario.id,
    });

    return res.status(201).json({
      message: "Producto creado correctamente",
      producto: nuevoProducto,
    });
  } catch (error) {
    await compensarImagenSubida(imagenSubida);
    throw error;
  }
});

// Actualiza los datos editables de un producto y permite
// reemplazar opcionalmente su imagen.
//
// Si PostgreSQL falla, elimina la nueva imagen.
// Si PostgreSQL termina correctamente, elimina la imagen anterior.
export const actualizarProductoController = asyncHandler(async (req, res) => {
  const { datosProducto, imagenSubida } =
    await construirDatosProductoConImagen(req.body, req.file);

  try {
    const { producto, imagenAnteriorUrl } = await actualizarProducto({
      productoId: req.params.id,
      datosProducto,
      usuarioId: req.usuario.id,
    });

    await limpiarImagenAnteriorReemplazada({
      imagenSubida,
      imagenAnteriorUrl,
    });

    return res.status(200).json({
      message: "Producto actualizado correctamente",
      producto,
    });
  } catch (error) {
    await compensarImagenSubida(imagenSubida);
    throw error;
  }
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