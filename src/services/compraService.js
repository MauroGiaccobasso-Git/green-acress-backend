import prisma from "../config/prisma.js";
import { registrarAuditoria } from "./auditoriaService.js";
import { incrementarStock } from "./stockService.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

const validarIdProveedor = (id) => {
  const proveedorId = Number(id);

  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    throw new AppError("El id del proveedor es inválido", 400);
  }

  return proveedorId;
};

const validarIdProducto = (id) => {
  const productoId = Number(id);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El id del producto es inválido", 400);
  }

  return productoId;
};

const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario autenticado es inválido", 401);
  }

  return usuarioId;
};

const validarCantidadCompra = (cantidad) => {
  const cantidadNumerica = Number(cantidad);

  if (Number.isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
    throw new AppError("La cantidad comprada debe ser mayor a cero", 400);
  }

  return cantidadNumerica;
};

const validarPrecioUnitarioCompra = (precioUnitario) => {
  const precioNumerico = Number(precioUnitario);

  if (Number.isNaN(precioNumerico) || precioNumerico <= 0) {
    throw new AppError("El precio unitario debe ser mayor a cero", 400);
  }

  return precioNumerico;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerProveedorPorId = async (proveedorId, tx = prisma) => {
  const proveedor = await tx.proveedor.findUnique({
    where: { id: proveedorId },
  });

  if (!proveedor) {
    throw new AppError("El proveedor indicado no existe", 404);
  }

  return proveedor;
};

const obtenerProductoPorId = async (productoId, tx = prisma) => {
  const producto = await tx.producto.findUnique({
    where: { id: productoId },
  });

  if (!producto) {
    throw new AppError("El producto indicado no existe", 404);
  }

  return producto;
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

const validarProveedorActivo = (proveedor) => {
  if (proveedor.estado !== "ACTIVO") {
    throw new AppError(
      "No se puede registrar una compra con un proveedor inactivo",
      400,
    );
  }
};

/**
 * En el MVP, las compras a proveedores únicamente pueden incluir
 * productos de tipo SEMILLA.
 *
 * Las flores no se compran a proveedores externos dentro del flujo del MVP;
 * ingresan al inventario mediante aumentos manuales de stock realizados
 * por administradores, representando procesos internos de producción.
 *
 * Importante:
 * No se exige que la semilla esté ACTIVA, porque el estado del producto
 * representa visibilidad o disponibilidad dentro del catálogo, no la posibilidad
 * administrativa de reabastecerlo mediante una compra.
 */
const validarProductoComprable = (producto) => {
  if (producto.tipo !== "SEMILLA") {
    throw new AppError(
      "Solo se permite registrar compras de productos tipo SEMILLA",
      400,
    );
  }
};

const validarDetallesCompra = (detalles) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError("La compra debe incluir al menos un producto", 400);
  }
};

/* =========================================================
   TRANSFORMACIÓN DE DATOS
========================================================= */

const construirDetalleCompra = (detalle) => {
  const productoId = validarIdProducto(detalle.producto_id);
  const cantidad = validarCantidadCompra(detalle.cantidad);
  const precioUnitario = validarPrecioUnitarioCompra(detalle.precio_unitario);

  return {
    producto_id: productoId,
    cantidad,
    precio_unitario: precioUnitario,
    subtotal: cantidad * precioUnitario,
  };
};

const calcularTotalCompra = (detalles) => {
  return detalles.reduce((total, detalle) => total + detalle.subtotal, 0);
};

/* =========================================================
   REGISTRO DE COMPRA
========================================================= */

export const registrarCompra = async (datosCompra, usuarioAutenticadoId) => {
  const usuarioId = validarIdUsuario(usuarioAutenticadoId);
  const proveedorId = validarIdProveedor(datosCompra.proveedor_id);
  const observaciones = datosCompra.observaciones?.trim() || null;

  validarDetallesCompra(datosCompra.detalles);

  const detallesNormalizados = datosCompra.detalles.map(construirDetalleCompra);
  const totalCompra = calcularTotalCompra(detallesNormalizados);

  return prisma.$transaction(async (tx) => {
    const proveedor = await obtenerProveedorPorId(proveedorId, tx);
    validarProveedorActivo(proveedor);

    // Se valida cada producto dentro de la misma transacción.
    // Compra no crea productos nuevos: cada detalle debe referenciar
    // un producto existente de tipo SEMILLA.
    for (const detalle of detallesNormalizados) {
      const producto = await obtenerProductoPorId(detalle.producto_id, tx);

      validarProductoComprable(producto);
    }

    const compra = await tx.compra.create({
      data: {
        proveedor_id: proveedorId,
        usuario_id: usuarioId,
        observaciones,
        detalles: {
          create: detallesNormalizados,
        },
      },
      include: {
        proveedor: true,
        usuario: {
          select: {
            id: true,
            email: true,
            rol: true,
          },
        },
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });

    // Trazabilidad de inventario:
    // cada semilla comprada genera un ingreso de stock y su MovimientoStock.
    for (const detalle of detallesNormalizados) {
      await incrementarStock(
        {
          productoId: detalle.producto_id,
          cantidad: detalle.cantidad,
          referenciaTipo: "COMPRA",
          referenciaId: compra.id,
        },
        tx,
      );
    }

    // Trazabilidad administrativa:
    // registra quién realizó la compra y sobre qué entidad impactó.
    await registrarAuditoria(
      {
        usuarioId,
        accion: "REGISTRAR_COMPRA",
        entidad: "Compra",
        entidadId: compra.id,
        detalle: `Compra registrada al proveedor ${proveedor.nombre} con ${detallesNormalizados.length} producto(s). Total: ${totalCompra}.`,
      },
      tx,
    );

    return compra;
  });
};