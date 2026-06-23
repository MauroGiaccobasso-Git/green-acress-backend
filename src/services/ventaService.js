import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { descontarStock, incrementarStock } from "./stockService.js";
import { registrarAuditoria } from "./auditoriaService.js";
import { validarLimiteLegalMensual } from "./limiteLegalService.js";

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

// Campos seguros del usuario.
// Nunca se expone password_hash ni datos internos de seguridad.
const usuarioSeguroSelect = {
  id: true,
  email: true,
  rol: true,
  estado: true,
};

// Campos seguros del socio para respuestas administrativas.
const socioSeguroSelect = {
  id: true,
  usuario_id: true,
  documento: true,
  nombre: true,
  apellido: true,
  telefono: true,
  estado: true,
  fecha_alta: true,
  consentimiento_aceptado: true,
  fecha_consentimiento: true,
  usuario: {
    select: usuarioSeguroSelect,
  },
};

// Campos seguros del producto dentro del detalle de venta.
const productoSeguroSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  precio_venta_actual: true,
  estado: true,
  genetica: true,
  porcentaje_thc: true,
  tipo: true,
  unidad_medida: true,
  imagen_url: true,
};

// Estructura segura para devolver ventas sin exponer datos sensibles.
const ventaSeguraSelect = {
  id: true,
  socio_id: true,
  usuario_id: true,
  fecha: true,
  estado: true,
  total: true,
  observaciones: true,
  fecha_creacion: true,
  fecha_actualizacion: true,
  socio: {
    select: socioSeguroSelect,
  },
  usuario: {
    select: usuarioSeguroSelect,
  },
  detalles: {
    select: {
      id: true,
      venta_id: true,
      producto_id: true,
      cantidad: true,
      precio_unitario: true,
      subtotal: true,
      producto: {
        select: productoSeguroSelect,
      },
    },
  },
};

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador del socio.
const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

// Convierte y valida el identificador de la venta.
const validarIdVenta = (id) => {
  const ventaId = Number(id);

  if (!Number.isInteger(ventaId) || ventaId <= 0) {
    throw new AppError("El id de la venta es inválido", 400);
  }

  return ventaId;
};

// Convierte y valida el usuario administrador responsable.
const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario administrador es obligatorio", 400);
  }

  return usuarioId;
};

// Valida una línea de detalle enviada desde frontend o Postman.
const validarDetalleVenta = (detalle) => {
  const productoId = Number(detalle.producto_id);
  const cantidad = Number(detalle.cantidad);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El producto de la venta es inválido", 400);
  }

  if (Number.isNaN(cantidad) || cantidad <= 0) {
    throw new AppError("La cantidad vendida debe ser mayor a cero", 400);
  }

  return { productoId, cantidad };
};

// Valida que la venta incluya al menos un detalle válido.
const validarDetallesVenta = (detalles) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError("La venta debe incluir al menos un producto", 400);
  }

  const detallesNormalizados = detalles.map(validarDetalleVenta);

  const productosIds = detallesNormalizados.map((detalle) => detalle.productoId);
  const productosUnicos = new Set(productosIds);

  if (productosIds.length !== productosUnicos.size) {
    throw new AppError(
      "No se puede repetir el mismo producto dentro de una venta",
      400,
    );
  }

  return detallesNormalizados;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Busca el socio y verifica que exista.
const obtenerSocioPorId = async (socioId, tx = prisma) => {
  const socio = await tx.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    throw new AppError("El socio indicado no existe", 404);
  }

  return socio;
};

// Busca todos los productos involucrados en la venta.
const obtenerProductosPorIds = async (productosIds, tx = prisma) => {
  const productos = await tx.producto.findMany({
    where: {
      id: { in: productosIds },
    },
  });

  if (productos.length !== productosIds.length) {
    throw new AppError("Uno o más productos indicados no existen", 404);
  }

  return productos;
};

// Busca una venta con detalle completo para consulta administrativa.
const obtenerVentaCompletaPorId = async (ventaId, tx = prisma) => {
  const venta = await tx.venta.findUnique({
    where: { id: ventaId },
    select: ventaSeguraSelect,
  });

  if (!venta) {
    throw new AppError("La venta indicada no existe", 404);
  }

  return venta;
};

// Busca una venta con sus datos necesarios para anulación.
const obtenerVentaParaAnulacion = async (ventaId, tx = prisma) => {
  const venta = await tx.venta.findUnique({
    where: { id: ventaId },
    include: {
      socio: true,
      detalles: true,
    },
  });

  if (!venta) {
    throw new AppError("La venta indicada no existe", 404);
  }

  return venta;
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

// Verifica que el socio esté habilitado para comprar.
const validarSocioActivo = (socio) => {
  if (socio.estado !== "ACTIVO") {
    throw new AppError("Solo socios activos pueden realizar compras", 400);
  }
};

// Verifica que la venta pueda ser anulada.
const validarVentaAnulable = (venta) => {
  if (venta.estado !== "REGISTRADA") {
    throw new AppError("Solo se pueden anular ventas registradas", 400);
  }
};

// Valida que cada producto sea una FLOR activa y con precio vigente.
const validarProductoVendible = (producto) => {
  if (producto.estado !== "ACTIVO") {
    throw new AppError(
      `El producto ${producto.nombre} no se encuentra activo`,
      400,
    );
  }

  if (producto.tipo !== "FLOR") {
    throw new AppError("Las ventas solo pueden incluir productos tipo FLOR", 400);
  }

  if (
    producto.precio_venta_actual === null ||
    producto.precio_venta_actual === undefined ||
    Number(producto.precio_venta_actual) <= 0
  ) {
    throw new AppError(
      `El producto ${producto.nombre} no tiene precio de venta válido`,
      400,
    );
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

// Construye filtros administrativos simples para el listado de ventas.
const construirFiltrosVentas = ({ search = "", estado, socioId } = {}) => {
  const filtros = {};

  if (estado) {
    filtros.estado = estado;
  }

  if (socioId) {
    filtros.socio_id = validarIdSocio(socioId);
  }

  const searchNormalizado = search.trim();

  if (searchNormalizado) {
    filtros.OR = [
      {
        socio: {
          nombre: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      },
      {
        socio: {
          apellido: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      },
      {
        socio: {
          documento: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  return filtros;
};

/* =========================================================
   HELPERS DE TRANSFORMACIÓN
========================================================= */

// Obtiene el producto correspondiente a una línea de detalle.
const obtenerProductoDelDetalle = (detalle, productos) => {
  return productos.find((producto) => producto.id === detalle.productoId);
};

// Calcula precio unitario y subtotal desde backend.
const calcularDetalleVenta = (detalle, productos) => {
  const producto = obtenerProductoDelDetalle(detalle, productos);

  validarProductoVendible(producto);

  const precioUnitario = Number(producto.precio_venta_actual);
  const subtotal = detalle.cantidad * precioUnitario;

  return {
    productoId: producto.id,
    cantidad: detalle.cantidad,
    precioUnitario,
    subtotal,
  };
};

// Calcula todos los detalles finales de la venta.
const calcularDetallesVenta = (detallesNormalizados, productos) => {
  return detallesNormalizados.map((detalle) =>
    calcularDetalleVenta(detalle, productos),
  );
};

// Suma la cantidad total de gramos de la operación.
const calcularGramosVenta = (detallesCalculados) => {
  return detallesCalculados.reduce(
    (total, detalle) => total + detalle.cantidad,
    0,
  );
};

// Suma el total económico de la venta.
const calcularTotalVenta = (detallesCalculados) => {
  return detallesCalculados.reduce(
    (total, detalle) => total + detalle.subtotal,
    0,
  );
};

/* =========================================================
   PERSISTENCIA Y OPERACIONES ASOCIADAS
========================================================= */

// Crea la venta y sus detalles preservando precios históricos.
const crearVentaConDetalles = async (
  { socioId, usuarioId, totalVenta, observaciones, detallesCalculados },
  tx,
) => {
  return tx.venta.create({
    data: {
      socio_id: socioId,
      usuario_id: usuarioId,
      total: totalVenta,
      observaciones,
      detalles: {
        create: detallesCalculados.map((detalle) => ({
          producto_id: detalle.productoId,
          cantidad: detalle.cantidad,
          precio_unitario: detalle.precioUnitario,
          subtotal: detalle.subtotal,
        })),
      },
    },
    select: ventaSeguraSelect,
  });
};

// Descuenta stock físico por cada producto vendido.
const descontarStockVenta = async (detallesCalculados, ventaId, tx) => {
  for (const detalle of detallesCalculados) {
    await descontarStock(
      {
        productoId: detalle.productoId,
        cantidad: detalle.cantidad,
        referenciaTipo: "VENTA",
        referenciaId: ventaId,
      },
      tx,
    );
  }
};

// Restituye stock físico cuando una venta registrada es anulada.
const restituirStockVentaAnulada = async (detallesVenta, ventaId, tx) => {
  for (const detalle of detallesVenta) {
    await incrementarStock(
      {
        productoId: detalle.producto_id,
        cantidad: detalle.cantidad,
        referenciaTipo: "ANULACION_VENTA",
        referenciaId: ventaId,
      },
      tx,
    );
  }
};

// Registra auditoría administrativa por alta de venta.
const auditarRegistroVenta = async (
  { usuarioId, ventaId, socio, totalVenta, gramosVenta },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "REGISTRAR_VENTA",
      entidad: "Venta",
      entidadId: ventaId,
      detalle: `Venta registrada al socio ${socio.nombre} ${socio.apellido}. Total: ${totalVenta}. Gramos: ${gramosVenta}.`,
    },
    tx,
  );
};

// Registra auditoría administrativa por anulación de venta.
const auditarAnulacionVenta = async ({ usuarioId, venta }, tx) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "ANULAR_VENTA",
      entidad: "Venta",
      entidadId: venta.id,
      detalle: `Venta anulada al socio ${venta.socio.nombre} ${venta.socio.apellido}. Se restituyó el stock asociado.`,
    },
    tx,
  );
};

/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */

export const getVentas = async (filtros = {}) => {
  const where = construirFiltrosVentas(filtros);

  return prisma.venta.findMany({
    where,
    select: ventaSeguraSelect,
    orderBy: {
      fecha: "desc",
    },
  });
};

export const getVentaPorId = async (id) => {
  const ventaId = validarIdVenta(id);

  return obtenerVentaCompletaPorId(ventaId);
};

export const registrarVenta = async ({
  socioId,
  usuarioId,
  detalles,
  observaciones = null,
}) => {
  const idSocio = validarIdSocio(socioId);
  const idUsuario = validarIdUsuario(usuarioId);
  const detallesNormalizados = validarDetallesVenta(detalles);

  return prisma.$transaction(async (tx) => {
    const socio = await obtenerSocioPorId(idSocio, tx);
    validarSocioActivo(socio);

    const productosIds = detallesNormalizados.map(
      (detalle) => detalle.productoId,
    );

    const productos = await obtenerProductosPorIds(productosIds, tx);
    const detallesCalculados = calcularDetallesVenta(
      detallesNormalizados,
      productos,
    );

    const gramosVenta = calcularGramosVenta(detallesCalculados);

    await validarLimiteLegalMensual({
      socioId: idSocio,
      gramosNuevaOperacion: gramosVenta,
      tx,
    });

    const totalVenta = calcularTotalVenta(detallesCalculados);

    const venta = await crearVentaConDetalles(
      {
        socioId: idSocio,
        usuarioId: idUsuario,
        totalVenta,
        observaciones,
        detallesCalculados,
      },
      tx,
    );

    await descontarStockVenta(detallesCalculados, venta.id, tx);

    await auditarRegistroVenta(
      {
        usuarioId: idUsuario,
        ventaId: venta.id,
        socio,
        totalVenta,
        gramosVenta,
      },
      tx,
    );

    return venta;
  });
};

export const anularVenta = async ({ ventaId, usuarioId }) => {
  const idVenta = validarIdVenta(ventaId);
  const idUsuario = validarIdUsuario(usuarioId);

  return prisma.$transaction(async (tx) => {
    const venta = await obtenerVentaParaAnulacion(idVenta, tx);

    validarVentaAnulable(venta);

    await tx.venta.update({
      where: { id: idVenta },
      data: {
        estado: "ANULADA",
      },
    });

    await restituirStockVentaAnulada(venta.detalles, idVenta, tx);
    await auditarAnulacionVenta({ usuarioId: idUsuario, venta }, tx);

    return obtenerVentaCompletaPorId(idVenta, tx);
  });
};