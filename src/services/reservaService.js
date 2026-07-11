import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import {
  reservarStock,
  liberarStockReservado,
  consumirStockReservado,
} from "./stockService.js";
import {
  registrarAuditoria,
  registrarAuditoriaSistema,
} from "./auditoriaService.js";
import { validarLimiteLegalMensual } from "./limiteLegalService.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const DIAS_LIMITE_RETIRO = Number(process.env.RESERVA_DIAS_LIMITE_RETIRO || 3);
const MULTIPLO_GRAMOS_FLOR = 0.5;

const ESTADOS_RESERVA_VALIDOS = [
  "PENDIENTE",
  "CONFIRMADA",
  "RECHAZADA",
  "CANCELADA",
  "VENCIDA",
  "FINALIZADA",
];

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

const usuarioSeguroSelect = {
  id: true,
  email: true,
  rol: true,
  estado: true,
};

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

const reservaSeguraSelect = {
  id: true,
  socio_id: true,
  usuario_id: true,
  fecha_solicitud: true,
  fecha_limite_retiro: true,
  estado: true,
  total: true,
  venta_id: true,
  observaciones: true,
  fecha_actualizacion: true,
  socio: {
    select: socioSeguroSelect,
  },
  usuario: {
    select: usuarioSeguroSelect,
  },
  venta: {
    select: {
      id: true,
      fecha: true,
      estado: true,
      total: true,
    },
  },
  detalles: {
    select: {
      id: true,
      reserva_id: true,
      producto_id: true,
      cantidad: true,
      precio_unitario: true,
      subtotal: true,
      producto: {
        select: productoSeguroSelect,
      },
    },
  },
  historial: {
    select: {
      id: true,
      reserva_id: true,
      usuario_id: true,
      estado: true,
      fecha: true,
      observaciones: true,
      usuario: {
        select: usuarioSeguroSelect,
      },
    },
    orderBy: {
      fecha: "asc",
    },
  },
};

/**
 * Selector resumido utilizado por el listado administrativo de reservas.
 *
 * Devuelve únicamente la información necesaria para la grilla de
 * administración, evitando cargar relaciones que solamente son requeridas
 * en el detalle completo de una reserva.
 */
const reservaResumenSelect = {
  id: true,
  socio_id: true,
  usuario_id: true,
  fecha_solicitud: true,
  fecha_limite_retiro: true,
  estado: true,
  total: true,
  venta_id: true,
  observaciones: true,
  fecha_actualizacion: true,

  socio: {
    select: socioSeguroSelect,
  },

  detalles: {
    select: {
      id: true,
      reserva_id: true,
      producto_id: true,
      cantidad: true,
      precio_unitario: true,
      subtotal: true,

      producto: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          unidad_medida: true,
          imagen_url: true,
        },
      },
    },
  },
};

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

const validarIdReserva = (id) => {
  const reservaId = Number(id);

  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    throw new AppError("El id de la reserva es inválido", 400);
  }

  return reservaId;
};

const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario autenticado es obligatorio", 400);
  }

  return usuarioId;
};

const validarIdSocio = (id) => {
  const socioId = Number(id);

  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return socioId;
};

const validarIdProducto = (id) => {
  const productoId = Number(id);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El id del producto es inválido", 400);
  }

  return productoId;
};

const validarDetalleReserva = (detalle) => {
  const productoId = validarIdProducto(detalle.producto_id);
  const cantidad = Number(detalle.cantidad);

  if (Number.isNaN(cantidad) || cantidad <= 0) {
    throw new AppError("La cantidad reservada debe ser mayor a cero", 400);
  }

  if (!Number.isInteger(cantidad / MULTIPLO_GRAMOS_FLOR)) {
    throw new AppError(
      "La cantidad reservada debe expresarse en múltiplos de 0.5 gramos",
      400,
    );
  }

  return { productoId, cantidad };
};

const validarDetallesReserva = (detalles) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError("La reserva debe incluir al menos un producto", 400);
  }

  const detallesNormalizados = detalles.map(validarDetalleReserva);

  const productosIds = detallesNormalizados.map(
    (detalle) => detalle.productoId,
  );

  const productosUnicos = new Set(productosIds);

  if (productosIds.length !== productosUnicos.size) {
    throw new AppError(
      "No se puede repetir el mismo producto dentro de una reserva",
      400,
    );
  }

  return detallesNormalizados;
};

const validarEstadoReservaFiltro = (estado) => {
  if (!ESTADOS_RESERVA_VALIDOS.includes(estado)) {
    throw new AppError("El estado de reserva indicado no es válido", 400);
  }

  return estado;
};

const validarFechaFiltro = (fecha, campo) => {
  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    throw new AppError(`La fecha ${campo} no es válida`, 400);
  }

  return fechaConvertida;
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

const obtenerSocioDesdeUsuario = async (usuarioId, tx = prisma) => {
  const usuario = await tx.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      socio: true,
    },
  });

  if (!usuario) {
    throw new AppError("El usuario autenticado no existe", 404);
  }

  if (usuario.rol !== "SOCIO") {
    throw new AppError("Solo los socios pueden solicitar reservas", 403);
  }

  if (usuario.estado !== "ACTIVO") {
    throw new AppError("El usuario no se encuentra activo", 400);
  }

  if (!usuario.socio) {
    throw new AppError("El usuario no tiene un socio asociado", 400);
  }

  return usuario.socio;
};

const obtenerProductosPorIds = async (productosIds, tx = prisma) => {
  const productos = await tx.producto.findMany({
    where: {
      id: { in: productosIds },
    },
    include: {
      stock: true,
    },
  });

  if (productos.length !== productosIds.length) {
    throw new AppError("Uno o más productos indicados no existen", 404);
  }

  return productos;
};

const obtenerReservaCompletaPorId = async (reservaId, tx = prisma) => {
  const reserva = await tx.reserva.findUnique({
    where: { id: reservaId },
    select: reservaSeguraSelect,
  });

  if (!reserva) {
    throw new AppError("La reserva indicada no existe", 404);
  }

  return reserva;
};

const obtenerReservaParaCambioEstado = async (reservaId, tx = prisma) => {
  const reserva = await tx.reserva.findUnique({
    where: { id: reservaId },
    include: {
      socio: true,
      detalles: {
        include: {
          producto: true,
        },
      },
    },
  });

  if (!reserva) {
    throw new AppError("La reserva indicada no existe", 404);
  }

  return reserva;
};

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

const validarSocioActivo = (socio) => {
  if (socio.estado !== "ACTIVO") {
    throw new AppError("Solo socios activos pueden realizar reservas", 400);
  }
};

const validarProductoReservable = (producto) => {
  if (producto.estado !== "ACTIVO") {
    throw new AppError(
      `El producto ${producto.nombre} no se encuentra activo`,
      400,
    );
  }

  if (producto.tipo !== "FLOR") {
    throw new AppError(
      "Las reservas solo pueden incluir productos tipo FLOR",
      400,
    );
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

const validarStockDisponibleReserva = (producto, cantidad) => {
  if (!producto.stock) {
    throw new AppError(
      `El producto ${producto.nombre} no tiene stock asociado`,
      400,
    );
  }

  if (Number(producto.stock.cantidad_disponible) <= 0) {
    throw new AppError(
      `El producto ${producto.nombre} no tiene stock disponible`,
      400,
    );
  }

  if (Number(producto.stock.cantidad_disponible) < cantidad) {
    throw new AppError(
      `Stock insuficiente para reservar ${producto.nombre}`,
      400,
    );
  }
};

const validarReservaCancelable = (reserva) => {
  if (reserva.estado !== "CONFIRMADA") {
    throw new AppError("Solo se pueden cancelar reservas confirmadas", 400);
  }
};

// Valida que una reserva pueda completar su retiro presencial.
// La operación solo aplica sobre reservas confirmadas y todavía no convertidas.
const validarReservaRetirable = (reserva) => {
  if (reserva.estado !== "CONFIRMADA") {
    throw new AppError(
      "Solo se puede confirmar el retiro de reservas confirmadas",
      400,
    );
  }

  if (reserva.venta_id !== null) {
    throw new AppError("La reserva ya fue convertida en una venta", 400);
  }

  if (!Array.isArray(reserva.detalles) || reserva.detalles.length === 0) {
    throw new AppError("La reserva no contiene productos para retirar", 400);
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

const construirFiltrosReservas = ({
  search = "",
  estado,
  socioId,
  productoId,
  fechaDesde,
  fechaHasta,
} = {}) => {
  const filtros = {};

  if (estado) {
    filtros.estado = validarEstadoReservaFiltro(estado);
  }

  if (socioId) {
    filtros.socio_id = validarIdSocio(socioId);
  }

  if (productoId) {
    filtros.detalles = {
      some: {
        producto_id: validarIdProducto(productoId),
      },
    };
  }

  if (fechaDesde || fechaHasta) {
    const fechaDesdeConvertida = fechaDesde
      ? validarFechaFiltro(fechaDesde, "desde")
      : null;

    const fechaHastaConvertida = fechaHasta
      ? validarFechaFiltro(fechaHasta, "hasta")
      : null;

    if (
      fechaDesdeConvertida &&
      fechaHastaConvertida &&
      fechaDesdeConvertida > fechaHastaConvertida
    ) {
      throw new AppError(
        "La fecha desde no puede ser mayor que la fecha hasta",
        400,
      );
    }

    filtros.fecha_solicitud = {};

    if (fechaDesdeConvertida) {
      filtros.fecha_solicitud.gte = fechaDesdeConvertida;
    }

    if (fechaHastaConvertida) {
      fechaHastaConvertida.setDate(fechaHastaConvertida.getDate() + 1);
      filtros.fecha_solicitud.lt = fechaHastaConvertida;
    }
  }

  const searchNormalizado = search.trim();

  if (searchNormalizado) {
    const reservaIdSearch = searchNormalizado.replace(/\D/g, "");
    const reservaId = reservaIdSearch ? Number(reservaIdSearch) : null;

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
      {
        detalles: {
          some: {
            producto: {
              nombre: {
                contains: searchNormalizado,
                mode: "insensitive",
              },
            },
          },
        },
      },
    ];

    if (reservaId && Number.isInteger(reservaId)) {
      filtros.OR.push({
        id: reservaId,
      });
    }
  }

  return filtros;
};

/* =========================================================
   HELPERS DE TRANSFORMACIÓN
========================================================= */

const obtenerProductoDelDetalle = (detalle, productos) => {
  return productos.find((producto) => producto.id === detalle.productoId);
};

const calcularDetalleReserva = (detalle, productos) => {
  const producto = obtenerProductoDelDetalle(detalle, productos);

  validarProductoReservable(producto);

  const precioUnitario = Number(producto.precio_venta_actual);
  const subtotal = detalle.cantidad * precioUnitario;

  return {
    productoId: producto.id,
    cantidad: detalle.cantidad,
    precioUnitario,
    subtotal,
    producto,
  };
};

const calcularDetallesReserva = (detallesNormalizados, productos) => {
  return detallesNormalizados.map((detalle) =>
    calcularDetalleReserva(detalle, productos),
  );
};

const calcularGramosReserva = (detallesCalculados) => {
  return detallesCalculados.reduce(
    (total, detalle) => total + detalle.cantidad,
    0,
  );
};

const calcularTotalReserva = (detallesCalculados) => {
  return detallesCalculados.reduce(
    (total, detalle) => total + detalle.subtotal,
    0,
  );
};

const agregarDiasHabiles = (fecha, diasHabiles) => {
  const resultado = new Date(fecha);
  let diasAgregados = 0;

  while (diasAgregados < diasHabiles) {
    resultado.setDate(resultado.getDate() + 1);

    const diaSemana = resultado.getDay();

    if (diaSemana !== 0 && diaSemana !== 6) {
      diasAgregados++;
    }
  }

  return resultado;
};

const calcularFechaLimiteRetiro = () => {
  const fechaLimite = agregarDiasHabiles(new Date(), DIAS_LIMITE_RETIRO);

  fechaLimite.setHours(23, 59, 59, 999);

  return fechaLimite;
};

/* =========================================================
   HELPERS DE PERSISTENCIA
========================================================= */

const crearReservaPendienteConDetalles = async (
  { socioId, usuarioId, totalReserva, observaciones, detallesCalculados },
  tx,
) => {
  return tx.reserva.create({
    data: {
      socio_id: socioId,
      usuario_id: usuarioId,
      estado: "PENDIENTE",
      total: totalReserva,
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
  });
};

const registrarHistorialReserva = async (
  { reservaId, usuarioId = null, estado, observaciones = null },
  tx,
) => {
  return tx.historialReserva.create({
    data: {
      reserva_id: reservaId,
      usuario_id: usuarioId,
      estado,
      observaciones,
    },
  });
};

const actualizarEstadoReserva = async (
  { reservaId, estado, fechaLimiteRetiro = undefined },
  tx,
) => {
  const data = { estado };

  if (fechaLimiteRetiro !== undefined) {
    data.fecha_limite_retiro = fechaLimiteRetiro;
  }

  return tx.reserva.update({
    where: { id: reservaId },
    data,
  });
};

// Crea la venta asociada utilizando exclusivamente la información histórica
// congelada en la reserva y sus detalles.
const crearVentaDesdeReserva = async (
  { reserva, usuarioId, observaciones },
  tx,
) => {
  return tx.venta.create({
    data: {
      socio_id: reserva.socio_id,
      usuario_id: usuarioId,
      total: reserva.total,
      observaciones,
      detalles: {
        create: reserva.detalles.map((detalle) => ({
          producto_id: detalle.producto_id,
          cantidad: detalle.cantidad,
          precio_unitario: detalle.precio_unitario,
          subtotal: detalle.subtotal,
        })),
      },
    },
  });
};

// Finaliza la reserva y la vincula con la venta generada.
// El update condicional evita que dos solicitudes concurrentes
// puedan convertir la misma reserva más de una vez.
const finalizarReservaConVenta = async ({ reservaId, ventaId }, tx) => {
  const resultado = await tx.reserva.updateMany({
    where: {
      id: reservaId,
      estado: "CONFIRMADA",
      venta_id: null,
    },
    data: {
      estado: "FINALIZADA",
      venta_id: ventaId,
    },
  });

  if (resultado.count !== 1) {
    throw new AppError(
      "La reserva ya fue procesada o no se encuentra disponible para retiro",
      400,
    );
  }
};

/* =========================================================
   OPERACIONES INTERNAS
========================================================= */

const validarProcesamientoReserva = async ({
  socioId,
  detallesCalculados,
  gramosReserva,
  tx,
}) => {
  try {
    for (const detalle of detallesCalculados) {
      validarStockDisponibleReserva(detalle.producto, detalle.cantidad);
    }

    await validarLimiteLegalMensual({
      socioId,
      gramosNuevaOperacion: gramosReserva,
      tx,
    });

    return { valida: true, motivo: null };
  } catch (error) {
    if (error instanceof AppError) {
      return { valida: false, motivo: error.message };
    }

    throw error;
  }
};

const bloquearStockReserva = async (detallesCalculados, reservaId, tx) => {
  for (const detalle of detallesCalculados) {
    await reservarStock(
      {
        productoId: detalle.productoId,
        cantidad: detalle.cantidad,
        referenciaTipo: "RESERVA",
        referenciaId: reservaId,
      },
      tx,
    );
  }
};

const liberarStockReserva = async (detallesReserva, reservaId, tx) => {
  for (const detalle of detallesReserva) {
    await liberarStockReservado(
      {
        productoId: detalle.producto_id,
        cantidad: detalle.cantidad,
        referenciaTipo: "RESERVA",
        referenciaId: reservaId,
      },
      tx,
    );
  }
};

// Consume el stock previamente reservado cuando se registra el retiro.
// El movimiento queda asociado a la Venta porque representa una salida física.
const consumirStockReservaRetirada = async (detallesReserva, ventaId, tx) => {
  for (const detalle of detallesReserva) {
    await consumirStockReservado(
      {
        productoId: detalle.producto_id,
        cantidad: detalle.cantidad,
        referenciaTipo: "VENTA",
        referenciaId: ventaId,
      },
      tx,
    );
  }
};

const confirmarReserva = async ({ reservaId, detallesCalculados }, tx) => {
  const fechaLimiteRetiro = calcularFechaLimiteRetiro();

  await bloquearStockReserva(detallesCalculados, reservaId, tx);

  await actualizarEstadoReserva(
    {
      reservaId,
      estado: "CONFIRMADA",
      fechaLimiteRetiro,
    },
    tx,
  );

  await registrarHistorialReserva(
    {
      reservaId,
      usuarioId: null,
      estado: "CONFIRMADA",
      observaciones: "Reserva confirmada automáticamente por el sistema.",
    },
    tx,
  );

  await registrarAuditoriaSistema(
    {
      accion: "CONFIRMAR_RESERVA",
      entidad: "Reserva",
      entidadId: reservaId,
      detalle:
        "Reserva confirmada automáticamente por el sistema. Se bloqueó el stock comprometido.",
    },
    tx,
  );
};

const rechazarReservaInterna = async ({ reservaId, motivo }, tx) => {
  await actualizarEstadoReserva(
    {
      reservaId,
      estado: "RECHAZADA",
      fechaLimiteRetiro: null,
    },
    tx,
  );

  await registrarHistorialReserva(
    {
      reservaId,
      usuarioId: null,
      estado: "RECHAZADA",
      observaciones:
        motivo || "Reserva rechazada automáticamente por el sistema.",
    },
    tx,
  );

  await registrarAuditoriaSistema(
    {
      accion: "RECHAZAR_RESERVA",
      entidad: "Reserva",
      entidadId: reservaId,
      detalle:
        motivo ||
        "Reserva rechazada automáticamente por el sistema durante el procesamiento.",
    },
    tx,
  );
};

const auditarSolicitudReserva = async (
  { usuarioId, reservaId, socio, totalReserva, gramosReserva },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "SOLICITAR_RESERVA",
      entidad: "Reserva",
      entidadId: reservaId,
      detalle: `Reserva solicitada por ${socio.nombre} ${socio.apellido}. Total: ${totalReserva}. Gramos: ${gramosReserva}.`,
    },
    tx,
  );
};

// Registra la trazabilidad administrativa del retiro presencial
// y de la conversión de la reserva en venta.
const auditarRetiroReserva = async (
  { usuarioId, reservaId, ventaId, socio },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CONVERTIR_RESERVA_EN_VENTA",
      entidad: "Reserva",
      entidadId: reservaId,
      detalle:
        `Reserva #${reservaId} retirada presencialmente por ` +
        `${socio.nombre} ${socio.apellido} y convertida en Venta #${ventaId}.`,
    },
    tx,
  );
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const getReservas = async (filtros = {}) => {
  const where = construirFiltrosReservas(filtros);

  return prisma.reserva.findMany({
    where,
    select: reservaResumenSelect,
    orderBy: {
      fecha_solicitud: "desc",
    },
  });
};

export const getReservaPorId = async (id) => {
  const reservaId = validarIdReserva(id);

  return obtenerReservaCompletaPorId(reservaId);
};

/* =========================================================
   CONSULTAS DEL SOCIO
========================================================= */

export const getReservasPorUsuarioSocio = async (usuarioId, filtros = {}) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const socio = await obtenerSocioDesdeUsuario(idUsuario);

  const where = {
    ...construirFiltrosReservas(filtros),
    socio_id: socio.id,
  };

  return prisma.reserva.findMany({
    where,
    select: reservaSeguraSelect,
    orderBy: {
      fecha_solicitud: "desc",
    },
  });
};

export const getReservaPorIdUsuarioSocio = async (usuarioId, reservaId) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const idReserva = validarIdReserva(reservaId);

  const socio = await obtenerSocioDesdeUsuario(idUsuario);

  const reserva = await prisma.reserva.findFirst({
    where: {
      id: idReserva,
      socio_id: socio.id,
    },
    select: reservaSeguraSelect,
  });

  if (!reserva) {
    throw new AppError("La reserva indicada no existe", 404);
  }

  return reserva;
};

export const solicitarReserva = async ({
  usuarioId,
  detalles,
  observaciones = null,
}) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const detallesNormalizados = validarDetallesReserva(detalles);

  return prisma.$transaction(async (tx) => {
    const socio = await obtenerSocioDesdeUsuario(idUsuario, tx);
    validarSocioActivo(socio);

    const productosIds = detallesNormalizados.map(
      (detalle) => detalle.productoId,
    );

    const productos = await obtenerProductosPorIds(productosIds, tx);

    const detallesCalculados = calcularDetallesReserva(
      detallesNormalizados,
      productos,
    );

    const gramosReserva = calcularGramosReserva(detallesCalculados);
    const totalReserva = calcularTotalReserva(detallesCalculados);

    const reserva = await crearReservaPendienteConDetalles(
      {
        socioId: socio.id,
        usuarioId: idUsuario,
        totalReserva,
        observaciones,
        detallesCalculados,
      },
      tx,
    );

    await registrarHistorialReserva(
      {
        reservaId: reserva.id,
        usuarioId: idUsuario,
        estado: "PENDIENTE",
        observaciones: "Reserva solicitada por el socio.",
      },
      tx,
    );

    await auditarSolicitudReserva(
      {
        usuarioId: idUsuario,
        reservaId: reserva.id,
        socio,
        totalReserva,
        gramosReserva,
      },
      tx,
    );

    const procesamiento = await validarProcesamientoReserva({
      socioId: socio.id,
      detallesCalculados,
      gramosReserva,
      tx,
    });

    if (!procesamiento.valida) {
      await rechazarReservaInterna(
        {
          reservaId: reserva.id,
          motivo: procesamiento.motivo,
        },
        tx,
      );

      return obtenerReservaCompletaPorId(reserva.id, tx);
    }

    await confirmarReserva(
      {
        reservaId: reserva.id,
        detallesCalculados,
      },
      tx,
    );

    return obtenerReservaCompletaPorId(reserva.id, tx);
  });
};

export const confirmarRetiroReserva = async ({
  reservaId,
  usuarioId,
  observaciones = null,
}) => {
  const idReserva = validarIdReserva(reservaId);
  const idUsuario = validarIdUsuario(usuarioId);

  return prisma.$transaction(async (tx) => {
    const reserva = await obtenerReservaParaCambioEstado(idReserva, tx);

    validarReservaRetirable(reserva);

    const venta = await crearVentaDesdeReserva(
      {
        reserva,
        usuarioId: idUsuario,
        observaciones,
      },
      tx,
    );

    await finalizarReservaConVenta(
      {
        reservaId: idReserva,
        ventaId: venta.id,
      },
      tx,
    );

    await consumirStockReservaRetirada(reserva.detalles, venta.id, tx);

    await registrarHistorialReserva(
      {
        reservaId: idReserva,
        usuarioId: idUsuario,
        estado: "FINALIZADA",
        observaciones:
          observaciones ||
          `Retiro presencial confirmado. Reserva convertida en Venta #${venta.id}.`,
      },
      tx,
    );

    await auditarRetiroReserva(
      {
        usuarioId: idUsuario,
        reservaId: idReserva,
        ventaId: venta.id,
        socio: reserva.socio,
      },
      tx,
    );

    return obtenerReservaCompletaPorId(idReserva, tx);
  });
};

export const cancelarReserva = async ({
  reservaId,
  usuarioId,
  observaciones = null,
}) => {
  const idReserva = validarIdReserva(reservaId);
  const idUsuario = validarIdUsuario(usuarioId);

  return prisma.$transaction(async (tx) => {
    const reserva = await obtenerReservaParaCambioEstado(idReserva, tx);

    validarReservaCancelable(reserva);

    if (reserva.estado === "CONFIRMADA") {
      await liberarStockReserva(reserva.detalles, idReserva, tx);
    }

    await actualizarEstadoReserva(
      {
        reservaId: idReserva,
        estado: "CANCELADA",
        fechaLimiteRetiro: null,
      },
      tx,
    );

    await registrarHistorialReserva(
      {
        reservaId: idReserva,
        usuarioId: idUsuario,
        estado: "CANCELADA",
        observaciones: observaciones || "Reserva cancelada manualmente.",
      },
      tx,
    );

    await registrarAuditoria(
      {
        usuarioId: idUsuario,
        accion: "CANCELAR_RESERVA",
        entidad: "Reserva",
        entidadId: idReserva,
        detalle:
          reserva.estado === "CONFIRMADA"
            ? "Reserva cancelada manualmente. Se liberó el stock reservado."
            : "Reserva cancelada manualmente.",
      },
      tx,
    );

    return obtenerReservaCompletaPorId(idReserva, tx);
  });
};

export const vencerReservasExpiradas = async () => {
  const ahora = new Date();

  const reservasVencidas = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      fecha_limite_retiro: {
        lt: ahora,
      },
    },
    include: {
      detalles: true,
    },
  });

  const resultados = [];

  for (const reserva of reservasVencidas) {
    const reservaProcesada = await prisma.$transaction(async (tx) => {
      await liberarStockReserva(reserva.detalles, reserva.id, tx);

      await actualizarEstadoReserva(
        {
          reservaId: reserva.id,
          estado: "VENCIDA",
          fechaLimiteRetiro: reserva.fecha_limite_retiro,
        },
        tx,
      );

      await registrarHistorialReserva(
        {
          reservaId: reserva.id,
          usuarioId: null,
          estado: "VENCIDA",
          observaciones:
            "Reserva vencida automáticamente por superar la fecha límite de retiro.",
        },
        tx,
      );

      await registrarAuditoriaSistema(
        {
          accion: "VENCER_RESERVA",
          entidad: "Reserva",
          entidadId: reserva.id,
          detalle:
            "Reserva vencida automáticamente por el sistema. Se liberó el stock reservado por superar la fecha límite de retiro.",
        },
        tx,
      );

      return obtenerReservaCompletaPorId(reserva.id, tx);
    });

    resultados.push(reservaProcesada);
  }

  return {
    cantidadProcesada: resultados.length,
    reservas: resultados,
  };
};
