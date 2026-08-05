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
   CONTROL DE CONCURRENCIA DEL DOMINIO COMPRAS
========================================================= */

/*
  Bloquea la fila del proveedor antes de validar su estado.

  ¿Qué carrera evita?

  Sin este bloqueo, una compra podría leer al proveedor como ACTIVO
  mientras otra solicitud lo cambia a INACTIVO al mismo tiempo.

  Con el bloqueo:

  - la compra y el cambio de estado se serializan por proveedor;
  - después de obtener el bloqueo se vuelve a leer su estado real;
  - no puede registrarse una compra usando información anterior.

  La fila se libera automáticamente al confirmar o revertir
  la transacción.
*/
const bloquearProveedorParaCompra = async (proveedorId, tx) => {
  const filasBloqueadas = await tx.$queryRaw`
    SELECT id
    FROM "Proveedor"
    WHERE id = ${proveedorId}
    FOR UPDATE
  `;

  if (filasBloqueadas.length === 0) {
    throw new AppError("El proveedor indicado no existe", 404);
  }
};

/*
  Devuelve los detalles ordenados por producto.

  Toda compra que afecte varios productos debe adquirir los bloqueos
  de stock siempre en el mismo orden para evitar deadlocks.

  Ejemplo inseguro:

  - compra A bloquea producto 2 y luego producto 1;
  - compra B bloquea producto 1 y luego producto 2.

  Ambas podrían quedar esperando a la otra.

  Con el orden ascendente, todas las compras bloquean:

  producto 1
  → producto 2
  → producto 3
*/
const ordenarDetallesCompraPorProducto = (detalles) => {
  return [...detalles].sort(
    (detalleA, detalleB) =>
      detalleA.producto_id - detalleB.producto_id,
  );
};

/*
  Bloquea previamente todas las filas de Stock involucradas
  en la compra, utilizando un orden determinista.

  Aunque incrementarStock también protege cada fila, este bloqueo
  anticipado garantiza que una compra con varios productos reserve
  todos sus bloqueos en el mismo orden que las demás operaciones.

  El bloqueo es por producto. Compras sobre productos distintos
  pueden continuar en paralelo.
*/
const bloquearStocksParaCompra = async (detallesOrdenados, tx) => {
  const productosIds = [
    ...new Set(
      detallesOrdenados.map((detalle) => detalle.producto_id),
    ),
  ];

  for (const productoId of productosIds) {
    const filasBloqueadas = await tx.$queryRaw`
      SELECT id
      FROM "Stock"
      WHERE producto_id = ${productoId}
      FOR UPDATE
    `;

    if (filasBloqueadas.length === 0) {
      throw new AppError(
        "Uno de los productos no tiene stock asociado",
        404,
      );
    }
  }
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
    /*
      CONCURRENCIA — PROVEEDOR

      Primero se bloquea la fila y luego se vuelve a leer el proveedor.
      Así la compra no puede continuar con un estado ACTIVO anterior
      a una inactivación concurrente.
    */
    await bloquearProveedorParaCompra(proveedorId, tx);

    const proveedor = await obtenerProveedorPorId(proveedorId, tx);
    validarProveedorActivo(proveedor);

    /*
      CONCURRENCIA — ORDEN DE PRODUCTOS

      Los detalles se ordenan una sola vez y ese mismo orden se utiliza
      para validar productos, bloquear stocks e incrementar inventario.
    */
    const detallesOrdenados =
      ordenarDetallesCompraPorProducto(detallesNormalizados);

    // Se valida cada producto dentro de la misma transacción.
    // Compra no crea productos nuevos: cada detalle debe referenciar
    // un producto existente de tipo SEMILLA.
    for (const detalle of detallesOrdenados) {
      const producto = await obtenerProductoPorId(
        detalle.producto_id,
        tx,
      );

      validarProductoComprable(producto);
    }

    /*
      CONCURRENCIA — INVENTARIO

      Se bloquean todas las filas de stock antes de crear la compra.
      Esto evita deadlocks entre compras simultáneas con varios
      productos y mantiene el ingreso de inventario completamente
      atómico junto con la compra y su auditoría.
    */
    await bloquearStocksParaCompra(detallesOrdenados, tx);

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
    //
    // El recorrido conserva el orden ascendente por producto para que
    // todas las transacciones adquieran bloqueos de manera consistente.
    for (const detalle of detallesOrdenados) {
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