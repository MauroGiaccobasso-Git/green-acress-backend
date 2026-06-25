import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONSTANTES DE NEGOCIO
========================================================= */

export const LIMITE_LEGAL_MENSUAL_GRAMOS = 40;

/* =========================================================
   HELPERS DE FECHAS
========================================================= */

// Obtiene el rango del mes calendario correspondiente a la fecha recibida.
const obtenerRangoMes = (fechaReferencia = new Date()) => {
  const inicioMes = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    1,
  );

  const finMes = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth() + 1,
    1,
  );

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

  if (Number.isNaN(gramos) || gramos <= 0) {
    throw new AppError("La cantidad a validar debe ser mayor a cero", 400);
  }

  return gramos;
};

/* =========================================================
   CÁLCULO DE CONSUMO MENSUAL
========================================================= */

// Calcula los gramos efectivamente vendidos al socio en el mes calendario.
const calcularGramosVendidosMes = async (
  socioId,
  fechaReferencia,
  tx = prisma,
) => {
  const { inicioMes, finMes } = obtenerRangoMes(fechaReferencia);

  const resultado = await tx.ventaDetalle.aggregate({
    _sum: { cantidad: true },
    where: {
      venta: {
        socio_id: socioId,
        estado: "REGISTRADA",
        fecha: {
          gte: inicioMes,
          lt: finMes,
        },
      },
      producto: {
        tipo: "FLOR",
      },
    },
  });

  return resultado._sum.cantidad || 0;
};

// Calcula los gramos comprometidos por reservas confirmadas del socio.
const calcularGramosReservadosConfirmadosMes = async () => {
  /*
    Según las reglas de negocio, el límite legal mensual debe considerar
    tanto ventas registradas como reservas confirmadas.

    Este componente queda centralizado acá para mantener una única fuente
    de verdad cuando el módulo Reservas consuma esta misma regla de dominio.
  */
  return 0;
};

export const calcularConsumoMensualSocio = async (
  socioId,
  fechaReferencia = new Date(),
  tx = prisma,
) => {
  const idSocio = validarIdSocio(socioId);

  const gramosVendidos = await calcularGramosVendidosMes(
    idSocio,
    fechaReferencia,
    tx,
  );

  const gramosReservadosConfirmados =
    await calcularGramosReservadosConfirmadosMes();

  const gramosConsumidos = gramosVendidos + gramosReservadosConfirmados;

  return {
    limiteLegal: LIMITE_LEGAL_MENSUAL_GRAMOS,
    gramosVendidos,
    gramosReservadosConfirmados,
    gramosConsumidos,
    gramosDisponibles: LIMITE_LEGAL_MENSUAL_GRAMOS - gramosConsumidos,
  };
};

/* =========================================================
   VALIDACIÓN DE LÍMITE LEGAL
========================================================= */

export const validarLimiteLegalMensual = async ({
  socioId,
  gramosNuevaOperacion,
  fechaReferencia = new Date(),
  tx = prisma,
}) => {
  const idSocio = validarIdSocio(socioId);
  const gramosOperacion = validarGramosOperacion(gramosNuevaOperacion);

  const consumoMensual = await calcularConsumoMensualSocio(
    idSocio,
    fechaReferencia,
    tx,
  );

  const totalProyectado =
    consumoMensual.gramosConsumidos + gramosOperacion;

  if (totalProyectado > LIMITE_LEGAL_MENSUAL_GRAMOS) {
    throw new AppError(
      `La operación supera el límite legal mensual de ${LIMITE_LEGAL_MENSUAL_GRAMOS}g. Disponible actual: ${consumoMensual.gramosDisponibles}g.`,
      400,
    );
  }

  return {
    ...consumoMensual,
    gramosNuevaOperacion: gramosOperacion,
    totalProyectado,
    gramosDisponiblesLuego:
      LIMITE_LEGAL_MENSUAL_GRAMOS - totalProyectado,
  };
};