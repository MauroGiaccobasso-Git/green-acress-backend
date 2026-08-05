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
import {
  notificarReservaConfirmada,
  notificarReservaCancelada,
  notificarReservaVencida,
} from "./notificacionService.js";

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

const ESTADOS_RESERVA_ACTIVA_PORTAL = ["PENDIENTE", "CONFIRMADA"];

const ETIQUETAS_ESTADO_RESERVA_PORTAL = {
  PENDIENTE: "Procesando",
  CONFIRMADA: "Lista para retirar",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
  FINALIZADA: "Retirada",
};

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

/**
 * Selector público utilizado por el Portal de Socios.
 *
 * Conserva únicamente la información necesaria para presentar la reserva
 * y evita exponer socios, administradores, auditorías o identificadores
 * internos de detalles y productos.
 */
const reservaPortalSocioSelect = {
  id: true,
  fecha_solicitud: true,
  fecha_limite_retiro: true,
  estado: true,
  total: true,

  detalles: {
    select: {
      cantidad: true,
      precio_unitario: true,
      subtotal: true,

      producto: {
        select: {
          nombre: true,
          imagen_url: true,
        },
      },
    },
  },

  historial: {
    select: {
      estado: true,
      fecha: true,
      observaciones: true,
    },
    orderBy: {
      fecha: "asc",
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
    select: {
      id: true,
      rol: true,
      estado: true,
      socio: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          estado: true,
        },
      },
    },
  });

  if (!usuario) {
    throw new AppError("El usuario autenticado no existe", 404);
  }

  if (usuario.rol !== "SOCIO") {
    throw new AppError(
      "La operación está disponible únicamente para socios",
      403,
    );
  }

  if (!usuario.socio) {
    throw new AppError("El usuario no tiene un socio asociado", 400);
  }

  return {
    usuario,
    socio: usuario.socio,
  };
};

/* =========================================================
   CONTROL DE CONCURRENCIA DEL DOMINIO RESERVAS
========================================================= */

/*
  Bloquea la fila del socio durante la solicitud de una reserva.

  ¿Qué carrera evita?

  Una suspensión administrativa podría ejecutarse al mismo tiempo
  que el socio solicita una reserva.

  Sin el bloqueo, la solicitud podría:

  1. leer al socio como ACTIVO;
  2. la suspensión cambiarlo a SUSPENDIDO;
  3. la reserva continuar y quedar CONFIRMADA igualmente.

  Con el bloqueo:

  - la solicitud y el cambio de estado se serializan por socio;
  - después de obtener el bloqueo se vuelve a leer su estado;
  - ninguna reserva puede confirmarse usando información anterior.

  Este bloqueo también establece el orden global del módulo:

  socio
  → stock de productos

  La fila se libera automáticamente al confirmar o revertir
  la transacción.
*/
const bloquearSocioParaReserva = async (socioId, tx) => {
  const filasBloqueadas = await tx.$queryRaw`
    SELECT id
    FROM "Socio"
    WHERE id = ${socioId}
    FOR UPDATE
  `;

  if (filasBloqueadas.length === 0) {
    throw new AppError("El socio indicado no existe", 404);
  }
};

/*
  Bloquea las filas de Stock involucradas antes de validar
  disponibilidad y confirmar la reserva.

  Los identificadores se ordenan siempre de menor a mayor.

  ¿Por qué es importante el orden?

  Dos reservas con varios productos podrían solicitar las mismas
  filas en órdenes distintos y generar un deadlock.

  Ordenarlas garantiza que todas las operaciones adquieran
  los bloqueos de inventario con el mismo criterio.

  Si un producto todavía no posee fila de stock, no se lanza
  el error aquí. La validación funcional posterior se encarga
  de rechazar la reserva con el mensaje correspondiente.
*/
const bloquearStocksParaReserva = async (productosIds, tx) => {
  const productosOrdenados = [...new Set(productosIds)].sort(
    (productoA, productoB) => productoA - productoB,
  );

  for (const productoId of productosOrdenados) {
    await tx.$queryRaw`
      SELECT id
      FROM "Stock"
      WHERE producto_id = ${productoId}
      FOR UPDATE
    `;
  }
};

/*
  Bloquea una reserva antes de cualquier transición de estado.

  Protege las competencias entre:

  - retiro;
  - cancelación;
  - vencimiento;
  - suspensión del socio.

  La operación que obtiene primero el bloqueo modifica la reserva.
  Las demás esperan, vuelven a leer el estado actual y ya no pueden
  aplicar una segunda transición incompatible.
*/
const bloquearReservaParaCambioEstado = async (reservaId, tx) => {
  const filasBloqueadas = await tx.$queryRaw`
    SELECT id
    FROM "Reserva"
    WHERE id = ${reservaId}
    FOR UPDATE
  `;

  if (filasBloqueadas.length === 0) {
    throw new AppError("La reserva indicada no existe", 404);
  }
};

/*
  Devuelve una copia ordenada de los detalles para que toda
  operación que adquiera varios bloqueos de stock utilice
  siempre el mismo orden por producto.
*/
const ordenarDetallesPorProducto = (detalles) => {
  return [...detalles].sort((detalleA, detalleB) => {
    const productoA = Number(
      detalleA.productoId ?? detalleA.producto_id,
    );

    const productoB = Number(
      detalleB.productoId ?? detalleB.producto_id,
    );

    return productoA - productoB;
  });
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
  await bloquearReservaParaCambioEstado(reservaId, tx);

  /*
    La lectura ocurre después del FOR UPDATE para trabajar siempre
    con el estado confirmado más reciente dentro de la transacción.
  */
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

const validarAccesoPortalSocio = ({ usuario, socio }) => {
  const estadosSocioPermitidos = ["ACTIVO", "INACTIVO"];

  if (
    usuario.estado !== "ACTIVO" ||
    !estadosSocioPermitidos.includes(socio.estado)
  ) {
    throw new AppError(
      "El socio no se encuentra habilitado para acceder al portal",
      403,
    );
  }
};

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

    const terminosBusqueda = searchNormalizado.split(/\s+/).filter(Boolean);

    filtros.OR = [
      {
        AND: terminosBusqueda.map((termino) => ({
          OR: [
            {
              socio: {
                nombre: {
                  contains: termino,
                  mode: "insensitive",
                },
              },
            },
            {
              socio: {
                apellido: {
                  contains: termino,
                  mode: "insensitive",
                },
              },
            },
          ],
        })),
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

// Obtiene la observación funcional correspondiente al estado actual.
const obtenerObservacionEstadoActual = (reserva) => {
  const historialEstadoActual = reserva.historial
    .filter((registro) => registro.estado === reserva.estado)
    .at(-1);

  return String(historialEstadoActual?.observaciones ?? "").trim();
};

// Obtiene un motivo comprensible para estados de historial.
const obtenerMotivoFuncionalReserva = (reserva) => {
  const observacionEstadoActual = obtenerObservacionEstadoActual(reserva);

  if (reserva.estado === "RECHAZADA") {
    return (
      observacionEstadoActual ||
      "La reserva fue rechazada porque no cumplió las condiciones requeridas."
    );
  }

  if (reserva.estado === "CANCELADA") {
    return observacionEstadoActual || "La reserva fue cancelada por el club.";
  }

  if (reserva.estado === "VENCIDA") {
    return "La reserva venció porque no fue retirada dentro del plazo establecido.";
  }

  return null;
};

// Construye el detalle público e histórico de un producto reservado.
// Los importes provienen del detalle congelado de la reserva y no
// del precio actual del producto.
const transformarDetalleReservaPortal = (detalle) => ({
  nombre: detalle.producto.nombre,
  imagen: detalle.producto.imagen_url,
  cantidad: Number(detalle.cantidad),
  precioUnitario: Number(detalle.precio_unitario),
  subtotal: Number(detalle.subtotal),
});

// Construye el contrato público de una reserva para el socio.
const transformarReservaPortalSocio = (reserva) => {
  const productos = reserva.detalles.map(transformarDetalleReservaPortal);

  const totalGramos = productos.reduce(
    (total, producto) => total + producto.cantidad,
    0,
  );

  return {
    id: reserva.id,
    fechaSolicitud: reserva.fecha_solicitud,
    fechaLimiteRetiro: reserva.fecha_limite_retiro,
    estado: reserva.estado,
    estadoDescripcion: ETIQUETAS_ESTADO_RESERVA_PORTAL[reserva.estado],
    motivo: obtenerMotivoFuncionalReserva(reserva),
    totalGramos,
    total: Number(reserva.total),
    productos,
  };
};

// Separa las reservas vigentes del historial personal del socio.
const construirReservasPortalSocio = (reservas) => {
  const reservasTransformadas = reservas.map(transformarReservaPortalSocio);

  return {
    activas: reservasTransformadas.filter((reserva) =>
      ESTADOS_RESERVA_ACTIVA_PORTAL.includes(reserva.estado),
    ),
    historial: reservasTransformadas.filter(
      (reserva) => !ESTADOS_RESERVA_ACTIVA_PORTAL.includes(reserva.estado),
    ),
  };
};

/* =========================================================
   HELPERS DE NOTIFICACIONES
========================================================= */

const formatearFechaLimiteRetiro = (fecha) => {
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Montevideo",
  }).format(new Date(fecha));
};

const notificarCancelacionesReservas = async (
  reservasParaNotificar,
  { cancelacionPorSuspension = false } = {},
) => {
  for (const reserva of reservasParaNotificar) {
    await notificarReservaCancelada({
      socioId: reserva.socioId,
      reservaId: reserva.reservaId,
      motivo: reserva.motivo,
      cancelacionPorSuspension,
    });
  }
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
//
// La fila ya se encuentra bloqueada mediante SELECT ... FOR UPDATE.
// El update condicional se conserva como defensa adicional para impedir
// que una reserva sea convertida más de una vez incluso si este helper
// fuera reutilizado incorrectamente en el futuro.
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
  fechaReferencia,
  tx,
}) => {
  try {
    for (const detalle of detallesCalculados) {
      validarStockDisponibleReserva(detalle.producto, detalle.cantidad);
    }

    await validarLimiteLegalMensual({
      socioId,
      gramosNuevaOperacion: gramosReserva,
      fechaReferencia,
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
  const detallesOrdenados = ordenarDetallesPorProducto(
    detallesCalculados,
  );

  for (const detalle of detallesOrdenados) {
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

/*
  Libera el stock comprometido por una reserva y registra
  el evento funcional que originó la liberación.

  La operación técnica continúa siendo liberar stock reservado,
  pero MovimientoStock debe persistir el evento de negocio real:
  - RESERVA_CANCELADA;
  - RESERVA_VENCIDA.

  Esto evita exponer LIBERACION_RESERVA como una operación
  administrativa independiente.
*/
const liberarStockReserva = async (
  detallesReserva,
  reservaId,
  tipoMovimiento,
  motivoLiberacion,
  tx,
) => {
  const detallesOrdenados = ordenarDetallesPorProducto(
    detallesReserva,
  );

  for (const detalle of detallesOrdenados) {
    await liberarStockReservado(
      {
        productoId: detalle.producto_id,
        cantidad: detalle.cantidad,
        tipoMovimiento,
        referenciaTipo: "RESERVA",
        referenciaId: reservaId,
        observaciones: motivoLiberacion,
      },
      tx,
    );
  }
};

// Consume el stock previamente reservado cuando se registra el retiro.
// El movimiento queda asociado a la Venta porque representa una salida física.
const consumirStockReservaRetirada = async (detallesReserva, ventaId, tx) => {
  const detallesOrdenados = ordenarDetallesPorProducto(
    detallesReserva,
  );

  for (const detalle of detallesOrdenados) {
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

/*
  Cancela una reserva activa reutilizando la misma operación de dominio
  tanto para la cancelación administrativa individual como para procesos
  internos que deban resolver reservas de un socio.

  Las reservas CONFIRMADAS liberan el stock previamente comprometido.
  Las reservas PENDIENTES no poseen stock bloqueado, por lo que únicamente
  se actualizan junto con su historial y auditoría.
*/
const cancelarReservaInterna = async (
  { reserva, usuarioId, observaciones, detalleAuditoria },
  tx,
) => {
  if (reserva.estado === "CONFIRMADA") {
    await liberarStockReserva(
      reserva.detalles,
      reserva.id,
      "RESERVA_CANCELADA",
      "Stock liberado por cancelación de reserva.",
      tx,
    );
  }

  await actualizarEstadoReserva(
    {
      reservaId: reserva.id,
      estado: "CANCELADA",
      fechaLimiteRetiro: null,
    },
    tx,
  );

  await registrarHistorialReserva(
    {
      reservaId: reserva.id,
      usuarioId,
      estado: "CANCELADA",
      observaciones,
    },
    tx,
  );

  await registrarAuditoria(
    {
      usuarioId,
      accion: "CANCELAR_RESERVA",
      entidad: "Reserva",
      entidadId: reserva.id,
      detalle: detalleAuditoria,
    },
    tx,
  );
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
  const contextoSocio = await obtenerSocioDesdeUsuario(idUsuario);

  validarAccesoPortalSocio(contextoSocio);

  const where = {
    ...construirFiltrosReservas(filtros),
    socio_id: contextoSocio.socio.id,
  };

  const reservas = await prisma.reserva.findMany({
    where,
    select: reservaPortalSocioSelect,
    orderBy: {
      fecha_solicitud: "desc",
    },
  });

  return construirReservasPortalSocio(reservas);
};

export const getReservaPorIdUsuarioSocio = async (usuarioId, reservaId) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const idReserva = validarIdReserva(reservaId);

  const contextoSocio = await obtenerSocioDesdeUsuario(idUsuario);

  validarAccesoPortalSocio(contextoSocio);

  const reserva = await prisma.reserva.findFirst({
    where: {
      id: idReserva,
      socio_id: contextoSocio.socio.id,
    },
    select: reservaPortalSocioSelect,
  });

  if (!reserva) {
    throw new AppError("La reserva indicada no existe", 404);
  }

  return transformarReservaPortalSocio(reserva);
};

export const solicitarReserva = async ({
  usuarioId,
  detalles,
  observaciones = null,
}) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const detallesNormalizados = validarDetallesReserva(detalles);

  const reservaProcesada = await prisma.$transaction(async (tx) => {
    /*
      Primero se identifica al socio, luego se bloquea su fila
      y finalmente se vuelve a leer su estado.

      Esta segunda lectura es obligatoria: evita confirmar una
      reserva con un estado anterior a una suspensión concurrente.
    */
    let contextoSocio = await obtenerSocioDesdeUsuario(idUsuario, tx);

    await bloquearSocioParaReserva(contextoSocio.socio.id, tx);

    contextoSocio = await obtenerSocioDesdeUsuario(idUsuario, tx);

    validarAccesoPortalSocio(contextoSocio);
    validarSocioActivo(contextoSocio.socio);

    const socio = contextoSocio.socio;

    const productosIds = detallesNormalizados.map(
      (detalle) => detalle.productoId,
    );

    /*
      El socio ya está bloqueado. A continuación se bloquean
      todos los stocks en orden determinista y recién después
      se leen sus cantidades.

      Así, disponibilidad, validación y confirmación utilizan
      valores estables dentro de la misma transacción.
    */
    await bloquearStocksParaReserva(productosIds, tx);

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
      fechaReferencia: reserva.fecha_solicitud,
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

  if (reservaProcesada.estado === "CONFIRMADA") {
    await notificarReservaConfirmada({
      socioId: reservaProcesada.socio_id,
      reservaId: reservaProcesada.id,
      fechaLimiteRetiro: formatearFechaLimiteRetiro(
        reservaProcesada.fecha_limite_retiro,
      ),
      detalles: reservaProcesada.detalles,
      total: reservaProcesada.total,
    });
  }

  return transformarReservaPortalSocio(reservaProcesada);
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

/*
  Cancela todas las reservas activas de un socio dentro de una única operación.

  Esta capacidad es utilizada por otros módulos cuando una regla de negocio
  exige resolver las reservas PENDIENTES o CONFIRMADAS del socio, sin duplicar
  la lógica propietaria del dominio Reservas.

  Si se recibe una transacción externa, la operación se integra a ella para
  conservar la atomicidad del proceso que originó la cancelación.
*/
export const cancelarReservasActivasPorSocio = async (
  { socioId, usuarioId, motivo },
  txExterna = null,
) => {
  const idSocio = validarIdSocio(socioId);
  const idUsuario = validarIdUsuario(usuarioId);
  const motivoNormalizado = String(motivo ?? "").trim();

  if (!motivoNormalizado) {
    throw new AppError(
      "El motivo de cancelación de las reservas es obligatorio",
      400,
    );
  }

  const operacion = async (tx) => {
    /*
      La suspensión bloquea primero al socio.

      Esto impide que una nueva solicitud de reserva se confirme
      mientras se están resolviendo sus reservas activas.
    */
    await bloquearSocioParaReserva(idSocio, tx);

    const reservasCandidatas = await tx.reserva.findMany({
      where: {
        socio_id: idSocio,
        estado: {
          in: ["PENDIENTE", "CONFIRMADA"],
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const reservasCanceladas = [];

    /*
      Cada reserva se bloquea y se vuelve a leer.

      Si otra operación la finalizó, canceló o venció antes,
      se omite de forma segura y no se libera stock dos veces.
    */
    for (const candidata of reservasCandidatas) {
      const reserva = await obtenerReservaParaCambioEstado(
        candidata.id,
        tx,
      );

      if (!["PENDIENTE", "CONFIRMADA"].includes(reserva.estado)) {
        continue;
      }

      const liberaStock = reserva.estado === "CONFIRMADA";

      await cancelarReservaInterna(
        {
          reserva,
          usuarioId: idUsuario,
          observaciones:
            `Reserva cancelada automáticamente por cambio de estado del socio. ` +
            `Motivo: ${motivoNormalizado}.`,
          detalleAuditoria:
            `Reserva cancelada por cambio de estado del socio. ` +
            `${liberaStock ? "Se liberó el stock reservado. " : ""}` +
            `Motivo: ${motivoNormalizado}.`,
        },
        tx,
      );

      reservasCanceladas.push(reserva);
    }

    return {
      cantidadCancelada: reservasCanceladas.length,
      reservasIds: reservasCanceladas.map((reserva) => reserva.id),
      reservasParaNotificar: reservasCanceladas.map((reserva) => ({
        socioId: idSocio,
        reservaId: reserva.id,
        motivo: motivoNormalizado,
      })),
    };
  };

  if (txExterna) {
    return operacion(txExterna);
  }

  const resultado = await prisma.$transaction(operacion);

  await notificarCancelacionesReservas(resultado.reservasParaNotificar, {
    cancelacionPorSuspension: true,
  });

  return resultado;
};

export const notificarCancelacionesReservasPorSuspension = async (
  reservasParaNotificar,
) => {
  if (!Array.isArray(reservasParaNotificar)) {
    throw new AppError(
      "Las reservas a notificar deben proporcionarse en una lista",
      400,
    );
  }

  await notificarCancelacionesReservas(reservasParaNotificar, {
    cancelacionPorSuspension: true,
  });
};

export const cancelarReserva = async ({
  reservaId,
  usuarioId,
  observaciones = null,
}) => {
  const idReserva = validarIdReserva(reservaId);
  const idUsuario = validarIdUsuario(usuarioId);
  const motivoCancelacion =
    String(observaciones ?? "").trim() || "Reserva cancelada manualmente.";

  const reservaCancelada = await prisma.$transaction(async (tx) => {
    const reserva = await obtenerReservaParaCambioEstado(idReserva, tx);

    validarReservaCancelable(reserva);

    await cancelarReservaInterna(
      {
        reserva,
        usuarioId: idUsuario,
        observaciones: motivoCancelacion,
        detalleAuditoria:
          "Reserva cancelada manualmente. Se liberó el stock reservado.",
      },
      tx,
    );

    return obtenerReservaCompletaPorId(idReserva, tx);
  });

  await notificarReservaCancelada({
    socioId: reservaCancelada.socio_id,
    reservaId: reservaCancelada.id,
    motivo: motivoCancelacion,
    detalles: reservaCancelada.detalles,
    total: reservaCancelada.total,
  });

  return reservaCancelada;
};

export const vencerReservasExpiradas = async () => {
  const ahora = new Date();

  /*
    La consulta inicial obtiene únicamente candidatos.

    No se confía en su estado para modificar datos, porque entre
    esta lectura y el procesamiento una reserva podría ser retirada
    o cancelada por otra solicitud.
  */
  const reservasCandidatas = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      fecha_limite_retiro: {
        lt: ahora,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const resultados = [];

  for (const candidata of reservasCandidatas) {
    const reservaProcesada = await prisma.$transaction(async (tx) => {
      /*
        El FOR UPDATE serializa vencimiento, cancelación y retiro.

        Después del bloqueo se vuelve a validar estado y fecha.
        Si otra operación ya resolvió la reserva, este job la omite
        y no toca nuevamente el stock.
      */
      const reserva = await obtenerReservaParaCambioEstado(
        candidata.id,
        tx,
      );

      const fechaLimiteRetiro = reserva.fecha_limite_retiro
        ? new Date(reserva.fecha_limite_retiro)
        : null;

      const sigueVencida =
        reserva.estado === "CONFIRMADA" &&
        fechaLimiteRetiro !== null &&
        fechaLimiteRetiro < ahora;

      if (!sigueVencida) {
        return null;
      }

      await liberarStockReserva(
        reserva.detalles,
        reserva.id,
        "RESERVA_VENCIDA",
        "Stock liberado por vencimiento de reserva.",
        tx,
      );

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

    if (!reservaProcesada) {
      continue;
    }

    await notificarReservaVencida({
      socioId: reservaProcesada.socio_id,
      reservaId: reservaProcesada.id,
      detalles: reservaProcesada.detalles,
      total: reservaProcesada.total,
    });

    resultados.push(reservaProcesada);
  }

  return {
    cantidadProcesada: resultados.length,
    reservas: resultados,
  };
};