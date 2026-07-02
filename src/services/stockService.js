import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const MAX_OBSERVACIONES_AJUSTE_LENGTH = 500;
const MAX_VARIACION_AJUSTE = 10000;
const MAX_DECIMALES_GRAMOS = 2;

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

// Valida la variación ingresada para un ajuste administrativo.
// Puede ser positiva o negativa, pero debe ser numérica, distinta de cero
// y mantenerse dentro de un rango operativo razonable.
const validarVariacionAjuste = (variacion) => {
  const variacionNumerica = Number(variacion);

  if (Number.isNaN(variacionNumerica)) {
    throw new AppError("La cantidad a ajustar debe ser un número válido", 400);
  }

  if (variacionNumerica === 0) {
    throw new AppError("La cantidad a ajustar debe ser distinta de cero", 400);
  }

  if (Math.abs(variacionNumerica) > MAX_VARIACION_AJUSTE) {
    throw new AppError(
      `La cantidad a ajustar no puede superar ${MAX_VARIACION_AJUSTE}`,
      400,
    );
  }

  return variacionNumerica;
};

// Valida que un ajuste manual quede correctamente justificado.
const validarObservacionesAjuste = (observaciones) => {
  const texto = String(observaciones ?? "").trim();

  if (!texto) {
    throw new AppError(
      "Debe ingresar una observación para justificar el ajuste",
      400,
    );
  }

  if (texto.length > MAX_OBSERVACIONES_AJUSTE_LENGTH) {
    throw new AppError(
      `La observación no puede superar los ${MAX_OBSERVACIONES_AJUSTE_LENGTH} caracteres`,
      400,
    );
  }

  return texto;
};

/*
  Valida y normaliza los parámetros de paginación.

  La paginación se resuelve en backend porque es responsabilidad
  de la API entregar conjuntos acotados y consistentes de datos.

  Esto evita que el frontend simule páginas con datos ya cargados,
  mantiene limpia la separación de responsabilidades y prepara el
  módulo para crecer sin afectar rendimiento.
*/
const validarPaginacion = ({ page = 1, limit = 5 } = {}) => {
  const pagina = Number(page);
  const limite = Number(limit);

  if (!Number.isInteger(pagina) || pagina <= 0) {
    throw new AppError("La página solicitada es inválida", 400);
  }

  if (!Number.isInteger(limite) || limite <= 0) {
    throw new AppError("El límite de registros es inválido", 400);
  }

  return {
    page: pagina,
    limit: limite,
    skip: (pagina - 1) * limite,
  };
};

/* =========================================================
   HELPERS
========================================================= */

// Obtiene el stock asociado a un producto.
// Se incluye el producto para validar reglas dependientes de la unidad operativa.
const obtenerStockPorProducto = async (productoId, tx = prisma) => {
  const stock = await tx.stock.findUnique({
    where: { producto_id: productoId },
    include: {
      producto: true,
    },
  });

  if (!stock) {
    throw new AppError("El producto no tiene stock asociado", 404);
  }

  return stock;
};

// Construye filtros administrativos para consultar inventario.
const construirFiltrosInventario = ({ search, tipo, estado } = {}) => ({
  producto: {
    ...(search
      ? {
          OR: [
            { nombre: { contains: search, mode: "insensitive" } },
            { descripcion: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
  },
});

// Construye filtros administrativos para consultar movimientos de stock.
const construirFiltrosMovimientos = ({
  search,
  tipo,
  referenciaTipo,
  productoId,
  fechaDesde,
  fechaHasta,
} = {}) => ({
  ...(tipo ? { tipo } : {}),
  ...(referenciaTipo ? { referencia_tipo: referenciaTipo } : {}),
  ...(productoId ? { producto_id: validarIdProducto(productoId) } : {}),
  ...(fechaDesde || fechaHasta
    ? {
        fecha_creacion: {
          ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}),
          ...(fechaHasta ? { lte: new Date(fechaHasta) } : {}),
        },
      }
    : {}),
  producto: {
    ...(search
      ? {
          OR: [
            { nombre: { contains: search, mode: "insensitive" } },
            { descripcion: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  },
});

/*
  Construye una respuesta paginada reutilizable.

  Se centraliza esta estructura para que inventario y movimientos
  devuelvan metadatos consistentes al frontend.
*/
const construirRespuestaPaginada = ({ data, total, page, limit }) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  },
});

/* =========================================================
   VALIDACIONES DE STOCK
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

// Valida que la variación respete la unidad operativa del producto.
// Las semillas se gestionan en unidades enteras; las flores admiten
// hasta una cantidad acotada de decimales para evitar precisiones innecesarias.
const validarCantidadCompatibleConUnidad = (producto, cantidad) => {
  if (producto.unidad_medida === "UNIDADES" && !Number.isInteger(cantidad)) {
    throw new AppError(
      "La cantidad a ajustar debe ser un número entero para productos medidos en unidades",
      400,
    );
  }

  if (producto.unidad_medida === "GRAMOS") {
    const decimales = String(cantidad).split(".")[1]?.length ?? 0;

    if (decimales > MAX_DECIMALES_GRAMOS) {
      throw new AppError(
        `La cantidad a ajustar admite como máximo ${MAX_DECIMALES_GRAMOS} decimales`,
        400,
      );
    }
  }
};

// Evita que el stock total resultante quede negativo.
const validarStockResultanteNoNegativo = (stockResultante) => {
  if (stockResultante < 0) {
    throw new AppError(
      "El ajuste no puede dejar el stock total en negativo",
      400,
    );
  }
};

// Evita que el stock total resultante quede por debajo del stock reservado.
const validarAjusteCompatibleConReservas = (stock, stockResultante) => {
  if (stockResultante < stock.cantidad_reservada) {
    throw new AppError(
      "El stock total resultante no puede ser menor al stock reservado",
      400,
    );
  }
};

/* =========================================================
   MOVIMIENTOS DE STOCK
========================================================= */

// Registra la trazabilidad de cada operación realizada sobre el inventario.
const registrarMovimientoStock = async (
  {
    productoId,
    tipo,
    cantidad,
    referenciaTipo = null,
    referenciaId = null,
    observaciones = null,
  },
  tx = prisma,
) => {
  return tx.movimientoStock.create({
    data: {
      producto_id: productoId,
      tipo,
      cantidad,
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
      observaciones,
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
   CONSULTAS ADMINISTRATIVAS
========================================================= */

/*
  Consulta el resumen global del inventario.

  Este resumen alimenta las KPI del panel administrativo
  y se calcula sobre la totalidad del inventario, no sobre
  los registros paginados visibles en la tabla.

  De esta forma, las métricas representan el estado real
  del stock global y el frontend no necesita realizar
  cálculos parciales ni cargar datos innecesarios.
*/
export const getResumenStock = async () => {
  const inventario = await prisma.stock.findMany({
    select: {
      cantidad_disponible: true,
      producto: {
        select: {
          tipo: true,
        },
      },
    },
  });

  return inventario.reduce(
    (resumen, item) => {
      const cantidadDisponible = Number(item.cantidad_disponible);

      resumen.productosInventario += 1;

      if (cantidadDisponible === 0) {
        resumen.productosSinStock += 1;
      }

      if (item.producto.tipo === "FLOR") {
        resumen.stockFloresDisponible += cantidadDisponible;
      }

      if (item.producto.tipo === "SEMILLA") {
        resumen.stockSemillasDisponible += cantidadDisponible;
      }

      return resumen;
    },
    {
      productosInventario: 0,
      stockFloresDisponible: 0,
      stockSemillasDisponible: 0,
      productosSinStock: 0,
    },
  );
};

// Consulta el inventario actual de productos para administración.
export const getInventario = async ({
  search,
  tipo,
  estado,
  page,
  limit,
} = {}) => {
  const where = construirFiltrosInventario({ search, tipo, estado });
  const paginacion = validarPaginacion({ page, limit });

  const [total, inventario] = await prisma.$transaction([
    prisma.stock.count({ where }),
    prisma.stock.findMany({
      where,
      skip: paginacion.skip,
      take: paginacion.limit,
      include: {
        producto: true,
      },
      orderBy: {
        producto: {
          nombre: "asc",
        },
      },
    }),
  ]);

  const data = inventario.map((item) => ({
    producto_id: item.producto_id,
    producto: {
      id: item.producto.id,
      nombre: item.producto.nombre,
      tipo: item.producto.tipo,
      genetica: item.producto.genetica,
      unidad_medida: item.producto.unidad_medida,
      estado: item.producto.estado,
      imagen_url: item.producto.imagen_url,
    },
    cantidad_total: item.cantidad_total,
    cantidad_reservada: item.cantidad_reservada,
    cantidad_disponible: item.cantidad_disponible,
    fecha_actualizacion: item.fecha_actualizacion,
  }));

  return construirRespuestaPaginada({
    data,
    total,
    page: paginacion.page,
    limit: paginacion.limit,
  });
};

// Consulta el historial de movimientos de stock para trazabilidad administrativa.
export const getMovimientosStock = async ({
  search,
  tipo,
  referenciaTipo,
  productoId,
  fechaDesde,
  fechaHasta,
  page,
  limit,
} = {}) => {
  const where = construirFiltrosMovimientos({
    search,
    tipo,
    referenciaTipo,
    productoId,
    fechaDesde,
    fechaHasta,
  });

  const paginacion = validarPaginacion({ page, limit });

  const [total, movimientos] = await prisma.$transaction([
    prisma.movimientoStock.count({ where }),
    prisma.movimientoStock.findMany({
      where,
      skip: paginacion.skip,
      take: paginacion.limit,
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            unidad_medida: true,
            estado: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: "desc",
      },
    }),
  ]);

  const data = movimientos.map((movimiento) => ({
    producto_id: movimiento.producto_id,
    producto: movimiento.producto,
    tipo: movimiento.tipo,
    cantidad: movimiento.cantidad,
    referencia_tipo: movimiento.referencia_tipo,
    referencia_id: movimiento.referencia_id,
    observaciones: movimiento.observaciones,
    fecha_creacion: movimiento.fecha_creacion,
  }));

  return construirRespuestaPaginada({
    data,
    total,
    page: paginacion.page,
    limit: paginacion.limit,
  });
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

// Ajusta manualmente el stock mediante una variación positiva o negativa.
// Uso esperado: correcciones administrativas de inventario.
export const ajustarStock = async (
  {
    productoId,
    variacion,
    referenciaTipo = "AJUSTE_MANUAL",
    referenciaId = null,
    observaciones,
  },
  txExterna = null,
) => {
  const idProducto = validarIdProducto(productoId);
  const variacionNumerica = validarVariacionAjuste(variacion);
  const observacionesAjuste = validarObservacionesAjuste(observaciones);

  const operacion = async (tx) => {
    const stockActual = await obtenerStockPorProducto(idProducto, tx);

    validarCantidadCompatibleConUnidad(stockActual.producto, variacionNumerica);

    const stockResultante = stockActual.cantidad_total + variacionNumerica;

    validarStockResultanteNoNegativo(stockResultante);
    validarAjusteCompatibleConReservas(stockActual, stockResultante);

    const stockDisponibleResultante =
      stockResultante - stockActual.cantidad_reservada;

    const stockActualizado = await tx.stock.update({
      where: { producto_id: idProducto },
      data: {
        cantidad_total: stockResultante,
        cantidad_disponible: stockDisponibleResultante,
      },
    });

    await registrarMovimientoStock(
      {
        productoId: idProducto,
        tipo: "AJUSTE",
        cantidad: variacionNumerica,
        referenciaTipo,
        referenciaId,
        observaciones: observacionesAjuste,
      },
      tx,
    );

    return stockActualizado;
  };

  return ejecutarOperacionStock(txExterna, operacion);
};
