import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador del producto.
const validarIdProducto = (id) => {
  const productoId = Number(id);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El id del producto es inválido", 400);
  }

  return productoId;
};

// Valida cantidades utilizadas en operaciones normales de stock.
// No se aceptan valores negativos ni cero.
const validarCantidadPositiva = (cantidad) => {
  const cantidadNumerica = Number(cantidad);

  if (Number.isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
    throw new AppError("La cantidad debe ser mayor a cero", 400);
  }

  return cantidadNumerica;
};

// Valida una cantidad total final para ajustes administrativos.
const validarCantidadTotalAjuste = (cantidadTotal) => {
  const cantidadNumerica = Number(cantidadTotal);

  if (Number.isNaN(cantidadNumerica) || cantidadNumerica < 0) {
    throw new AppError("La cantidad total ajustada no puede ser negativa", 400);
  }

  return cantidadNumerica;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

// Obtiene el stock asociado a un producto.
// Se recibe tx para poder reutilizar este helper dentro de transacciones.
const obtenerStockPorProducto = async (productoId, tx = prisma) => {
  const stock = await tx.stock.findUnique({
    where: { producto_id: productoId },
  });

  if (!stock) {
    throw new AppError("El producto no tiene stock asociado", 404);
  }

  return stock;
};

/* =========================================================
   HELPERS DE VALIDACIÓN DE STOCK
========================================================= */

// Verifica que exista stock disponible suficiente.
const validarStockDisponible = (stock, cantidad) => {
  if (stock.cantidad_disponible < cantidad) {
    throw new AppError("Stock disponible insuficiente", 400);
  }
};

// Verifica que exista stock reservado suficiente.
const validarStockReservado = (stock, cantidad) => {
  if (stock.cantidad_reservada < cantidad) {
    throw new AppError("Stock reservado insuficiente", 400);
  }
};

// Evita que un ajuste deje menos stock total que el ya reservado.
const validarAjusteCompatibleConReservas = (stock, nuevaCantidadTotal) => {
  if (nuevaCantidadTotal < stock.cantidad_reservada) {
    throw new AppError(
      "La cantidad total no puede ser menor al stock reservado",
      400,
    );
  }
};

/* =========================================================
   MOVIMIENTOS DE STOCK
========================================================= */

// Registra la trazabilidad de cada operación realizada sobre el inventario.
const registrarMovimientoStock = async (
  { productoId, tipo, cantidad, referenciaTipo = null, referenciaId = null },
  tx = prisma,
) => {
  return tx.movimientoStock.create({
    data: {
      producto_id: productoId,
      tipo,
      cantidad,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
    },
  });
};

/* =========================================================
   OPERACIONES INTERNAS
========================================================= */

/*
  Ejecuta una operación de stock de forma transaccional.

  Este helper permite que el stockService funcione en dos escenarios:

  1) Si la operación de stock se ejecuta sola:
     - el propio stockService abre una transacción nueva.
     - esto asegura que la actualización de Stock y el registro en MovimientoStock
       se guarden juntos o fallen juntos.

  2) Si la operación de stock se ejecuta dentro de otro módulo crítico:
     - por ejemplo compraService, ventaService o reservaService.
     - ese módulo puede pasar su propia transacción como txExterna.
     - en ese caso stockService reutiliza esa transacción y no crea otra.

  Esto evita transacciones anidadas, mantiene atomicidad y asegura que operaciones
  como crear una compra, crear sus detalles, actualizar stock y registrar movimientos
  se comporten como una única operación consistente.
*/
const ejecutarOperacionStock = async (txExterna, operacion) => {
  if (txExterna) {
    return operacion(txExterna);
  }

  return prisma.$transaction(async (tx) => operacion(tx));
};

/* =========================================================
   OPERACIONES DE STOCK
========================================================= */

// Incrementa el stock total y disponible.
// Uso esperado: compras o ingresos manuales.
export const incrementarStock = async (
  { productoId, cantidad, referenciaTipo = null, referenciaId = null },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const cantidadNumerica = validarCantidadPositiva(cantidad);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_total: stockActual.cantidad_total + cantidadNumerica,
        cantidad_disponible: stockActual.cantidad_disponible + cantidadNumerica,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "INGRESO",
        cantidad: cantidadNumerica,
        referenciaTipo,
        referenciaId,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};

// Descuenta stock total y disponible.
// Uso esperado: ventas o egresos manuales.
export const descontarStock = async (
  { productoId, cantidad, referenciaTipo = null, referenciaId = null },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const cantidadNumerica = validarCantidadPositiva(cantidad);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    validarStockDisponible(stockActual, cantidadNumerica);

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_total: stockActual.cantidad_total - cantidadNumerica,
        cantidad_disponible: stockActual.cantidad_disponible - cantidadNumerica,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "EGRESO",
        cantidad: cantidadNumerica,
        referenciaTipo,
        referenciaId,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};

// Bloquea stock disponible para una reserva confirmada.
// No modifica el stock total físico.
export const reservarStock = async (
  { productoId, cantidad, referenciaTipo = "RESERVA", referenciaId = null },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const cantidadNumerica = validarCantidadPositiva(cantidad);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    validarStockDisponible(stockActual, cantidadNumerica);

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_reservada: stockActual.cantidad_reservada + cantidadNumerica,
        cantidad_disponible: stockActual.cantidad_disponible - cantidadNumerica,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "RESERVA",
        cantidad: cantidadNumerica,
        referenciaTipo,
        referenciaId,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};

// Libera stock reservado por cancelación o vencimiento de reserva.
// No modifica el stock total físico.
export const liberarStockReservado = async (
  { productoId, cantidad, referenciaTipo = "RESERVA", referenciaId = null },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const cantidadNumerica = validarCantidadPositiva(cantidad);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    validarStockReservado(stockActual, cantidadNumerica);

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_reservada: stockActual.cantidad_reservada - cantidadNumerica,
        cantidad_disponible: stockActual.cantidad_disponible + cantidadNumerica,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "LIBERACION_RESERVA",
        cantidad: cantidadNumerica,
        referenciaTipo,
        referenciaId,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};

// Ajusta manualmente el stock total.
// Uso esperado: correcciones administrativas de inventario.
export const ajustarStock = async (
  {
    productoId,
    nuevaCantidadTotal,
    referenciaTipo = "AJUSTE_MANUAL",
    referenciaId = null,
  },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const cantidadTotalNumerica = validarCantidadTotalAjuste(nuevaCantidadTotal);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    validarAjusteCompatibleConReservas(stockActual, cantidadTotalNumerica);

    const nuevaCantidadDisponible =
      cantidadTotalNumerica - stockActual.cantidad_reservada;

    const diferencia = cantidadTotalNumerica - stockActual.cantidad_total;

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_total: cantidadTotalNumerica,
        cantidad_disponible: nuevaCantidadDisponible,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "AJUSTE",
        cantidad: diferencia,
        referenciaTipo,
        referenciaId,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};