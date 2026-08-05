import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES DE NEGOCIO
========================================================= */

export const LIMITE_LEGAL_MENSUAL_GRAMOS = 40;
export const ZONA_HORARIA_LIMITE_LEGAL = "America/Montevideo";

/* =========================================================
   HELPERS DE FECHAS
========================================================= */

const formateadorFechaMontevideo = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA_LIMITE_LEGAL,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// Normaliza y valida la fecha utilizada como referencia del período legal.
const validarFechaReferencia = (fechaReferencia) => {
  const fecha =
    fechaReferencia instanceof Date
      ? new Date(fechaReferencia.getTime())
      : new Date(fechaReferencia);

  if (Number.isNaN(fecha.getTime())) {
    throw new AppError("La fecha de referencia es inválida", 400);
  }

  return fecha;
};

// Obtiene las partes de una fecha interpretadas en la zona horaria legal.
const obtenerPartesFechaMontevideo = (fecha) => {
  const partes = formateadorFechaMontevideo.formatToParts(fecha);

  return partes.reduce((resultado, parte) => {
    if (parte.type !== "literal") {
      resultado[parte.type] = Number(parte.value);
    }

    return resultado;
  }, {});
};

// Convierte una fecha local de Montevideo al instante UTC equivalente.
const crearFechaUtcDesdeMontevideo = ({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
}) => {
  const objetivoLocalComoUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    0,
  );

  let instanteUtc = objetivoLocalComoUtc;

  // Dos iteraciones contemplan también posibles cambios históricos de offset.
  for (let intento = 0; intento < 2; intento += 1) {
    const partesMontevideo = obtenerPartesFechaMontevideo(
      new Date(instanteUtc),
    );

    const fechaMontevideoComoUtc = Date.UTC(
      partesMontevideo.year,
      partesMontevideo.month - 1,
      partesMontevideo.day,
      partesMontevideo.hour,
      partesMontevideo.minute,
      partesMontevideo.second,
      0,
    );

    instanteUtc += objetivoLocalComoUtc - fechaMontevideoComoUtc;
  }

  return new Date(instanteUtc);
};

// Obtiene el rango UTC del mes calendario vigente en America/Montevideo.
const obtenerRangoMes = (fechaReferencia = new Date()) => {
  const fecha = validarFechaReferencia(fechaReferencia);
  const { year, month } = obtenerPartesFechaMontevideo(fecha);

  const siguienteMes = month === 12 ? 1 : month + 1;
  const anioSiguienteMes = month === 12 ? year + 1 : year;

  const inicioMes = crearFechaUtcDesdeMontevideo({
    year,
    month,
    day: 1,
  });

  const finMes = crearFechaUtcDesdeMontevideo({
    year: anioSiguienteMes,
    month: siguienteMes,
    day: 1,
  });

  return { inicioMes, finMes };
};

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Valida el socio utilizado para calcular o validar consumo mensual.
const validarIdSocio = (socioId) => {
  const idSocio = Number(socioId);

  if (!Number.isInteger(idSocio) || idSocio <= 0) {
    throw new AppError("El id del socio es inválido", 400);
  }

  return idSocio;
};

// Valida la cantidad de gramos que se quiere incorporar al consumo mensual.
const validarGramosOperacion = (gramosNuevaOperacion) => {
  const gramos = Number(gramosNuevaOperacion);

  if (!Number.isFinite(gramos) || gramos <= 0) {
    throw new AppError("La cantidad a validar debe ser mayor a cero", 400);
  }

  return gramos;
};

/* =========================================================
   HELPERS DE CÁLCULO
========================================================= */

const obtenerCantidadAgregada = (resultado) => {
  return Number(resultado._sum.cantidad ?? 0);
};

// Calcula las ventas directas del período, excluyendo las generadas
// desde una reserva para evitar computar dos veces el mismo consumo.
const calcularGramosVentasDirectasMes = async (
  socioId,
  rangoMes,
  tx = prisma,
) => {
  const resultado = await tx.ventaDetalle.aggregate({
    _sum: { cantidad: true },
    where: {
      venta: {
        socio_id: socioId,
        estado: "REGISTRADA",
        fecha: {
          gte: rangoMes.inicioMes,
          lt: rangoMes.finMes,
        },
        reserva: {
          is: null,
        },
      },
      producto: {
        tipo: "FLOR",
      },
    },
  });

  return obtenerCantidadAgregada(resultado);
};

// Calcula los gramos de reservas solicitadas durante el período
// según el estado funcional recibido.
const calcularGramosReservasMesPorEstado = async (
  socioId,
  estado,
  rangoMes,
  tx = prisma,
) => {
  const resultado = await tx.reservaDetalle.aggregate({
    _sum: { cantidad: true },
    where: {
      reserva: {
        socio_id: socioId,
        estado,
        fecha_solicitud: {
          gte: rangoMes.inicioMes,
          lt: rangoMes.finMes,
        },
      },
      producto: {
        tipo: "FLOR",
      },
    },
  });

  return obtenerCantidadAgregada(resultado);
};

/* =========================================================
   CÁLCULO DE CONSUMO MENSUAL
========================================================= */

export const calcularConsumoMensualSocio = async (
  socioId,
  fechaReferencia = new Date(),
  tx = prisma,
) => {
  const idSocio = validarIdSocio(socioId);
  const rangoMes = obtenerRangoMes(fechaReferencia);

  const [
    gramosVentasDirectas,
    gramosReservasConfirmadas,
    gramosReservasFinalizadas,
  ] = await Promise.all([
    calcularGramosVentasDirectasMes(idSocio, rangoMes, tx),
    calcularGramosReservasMesPorEstado(
      idSocio,
      "CONFIRMADA",
      rangoMes,
      tx,
    ),
    calcularGramosReservasMesPorEstado(
      idSocio,
      "FINALIZADA",
      rangoMes,
      tx,
    ),
  ]);

  const gramosRetirados =
    gramosVentasDirectas + gramosReservasFinalizadas;
  const gramosReservados = gramosReservasConfirmadas;
  const gramosConsumidos = gramosRetirados + gramosReservados;

  const gramosDisponibles = Math.max(
    0,
    LIMITE_LEGAL_MENSUAL_GRAMOS - gramosConsumidos,
  );

  return {
    limiteLegal: LIMITE_LEGAL_MENSUAL_GRAMOS,
    gramosVendidos: gramosVentasDirectas,
    gramosReservasFinalizadas,
    gramosRetirados,
    gramosReservadosConfirmados: gramosReservados,
    gramosConsumidos,
    gramosDisponibles,
  };
};

/* =========================================================
   CONTROL DE CONCURRENCIA DEL LÍMITE LEGAL
========================================================= */

/*
  Bloquea la fila del socio mediante SELECT ... FOR UPDATE
  dentro de la misma transacción que registrará la reserva o venta.

  ¿Qué carrera evita?

  Sin este bloqueo, dos operaciones simultáneas del mismo socio
  podrían leer el mismo consumo mensual y aprobarse por separado.

  Ejemplo:
  - el socio lleva 35 g;
  - una venta solicita 5 g;
  - una reserva solicita 5 g al mismo tiempo.

  Ambas podrían calcular 35 + 5 = 40 y aprobarse, dejando un
  consumo real de 45 g.

  Con el bloqueo:
  - la primera operación obtiene la fila del socio;
  - la segunda espera;
  - la primera valida y registra su operación;
  - la segunda vuelve a calcular el consumo actualizado;
  - la segunda se rechaza si supera los 40 g.

  El bloqueo se aplica por socio, no sobre toda la tabla.
  Operaciones de socios distintos pueden continuar en paralelo.

  La fila se libera automáticamente al confirmar o revertir
  la transacción.
*/
const bloquearSocioParaValidacionLegal = async (socioId, tx) => {
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
  Ejecuta la validación legal dentro de una transacción activa.

  El orden es intencional y debe conservarse:

  bloquear socio
  → recalcular consumo mensual
  → proyectar nueva operación
  → validar límite

  Las operaciones que además modifican stock deben mantener
  este orden global:

  socio
  → stock de productos

  Así evitamos que ventas y reservas adquieran bloqueos
  incompatibles en órdenes distintos.
*/
const validarLimiteLegalMensualEnTransaccion = async ({
  socioId,
  gramosNuevaOperacion,
  fechaReferencia,
  tx,
}) => {
  await bloquearSocioParaValidacionLegal(socioId, tx);

  const consumoMensual = await calcularConsumoMensualSocio(
    socioId,
    fechaReferencia,
    tx,
  );

  const totalProyectado =
    consumoMensual.gramosConsumidos + gramosNuevaOperacion;

  if (totalProyectado > LIMITE_LEGAL_MENSUAL_GRAMOS) {
    throw new AppError(
      `La operación supera el límite legal mensual de ${LIMITE_LEGAL_MENSUAL_GRAMOS}g. Disponible actual: ${consumoMensual.gramosDisponibles}g.`,
      400,
    );
  }

  return {
    ...consumoMensual,
    gramosNuevaOperacion,
    totalProyectado,
    gramosDisponiblesLuego:
      LIMITE_LEGAL_MENSUAL_GRAMOS - totalProyectado,
  };
};

/* =========================================================
   VALIDACIÓN DE LÍMITE LEGAL
========================================================= */

export const validarLimiteLegalMensual = async ({
  socioId,
  gramosNuevaOperacion,
  fechaReferencia = new Date(),
  tx = null,
}) => {
  const idSocio = validarIdSocio(socioId);
  const gramosOperacion = validarGramosOperacion(gramosNuevaOperacion);
  const fecha = validarFechaReferencia(fechaReferencia);

  /*
    Las operaciones productivas ya entregan su cliente transaccional.

    El fallback crea una transacción propia para que una llamada directa
    tampoco ejecute SELECT ... FOR UPDATE fuera de una transacción útil.
  */
  if (!tx) {
    return prisma.$transaction((transaction) =>
      validarLimiteLegalMensualEnTransaccion({
        socioId: idSocio,
        gramosNuevaOperacion: gramosOperacion,
        fechaReferencia: fecha,
        tx: transaction,
      }),
    );
  }

  return validarLimiteLegalMensualEnTransaccion({
    socioId: idSocio,
    gramosNuevaOperacion: gramosOperacion,
    fechaReferencia: fecha,
    tx,
  });
};