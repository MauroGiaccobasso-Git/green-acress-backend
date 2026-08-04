import cron from "node-cron";

import { vencerReservasExpiradas } from "../services/reservaService.js";

/* =========================================================
   CONSTANTES DEL JOB
========================================================= */

const RESERVATION_EXPIRATION_JOB_NAME =
  "ReservationExpirationJob";

/*
 * Ejecuta todos los días a las 00:05.
 *
 * Se agenda unos minutos después de medianoche para evitar
 * ejecutarlo exactamente durante el cambio de día.
 */
const RESERVATION_EXPIRATION_CRON_EXPRESSION =
  process.env.RESERVATION_EXPIRATION_CRON || "5 0 * * *";

/*
 * La expresión cron siempre se interpreta utilizando la hora
 * oficial de Uruguay, independientemente de la zona horaria
 * configurada en el servidor donde se despliegue el backend.
 */
const RESERVATION_EXPIRATION_TIME_ZONE =
  process.env.RESERVATION_EXPIRATION_TIME_ZONE ||
  "America/Montevideo";

/* =========================================================
   HELPERS
========================================================= */

const logJobInfo = (message) => {
  console.log(
    `[${RESERVATION_EXPIRATION_JOB_NAME}] ${message}`,
  );
};

const logJobError = (error) => {
  console.error(
    `[${RESERVATION_EXPIRATION_JOB_NAME}] Error al procesar reservas vencidas:`,
    error,
  );
};

/* =========================================================
   PROCESAMIENTO DEL JOB
========================================================= */

const procesarReservasVencidasJob = async () => {
  logJobInfo(
    "Inicio del procesamiento automático de reservas vencidas.",
  );

  const resultado = await vencerReservasExpiradas();

  logJobInfo(
    `Procesamiento finalizado. Reservas vencidas procesadas: ${resultado.cantidadProcesada}.`,
  );
};

/* =========================================================
   INICIALIZACIÓN DEL JOB
========================================================= */

export const iniciarReservationExpirationJob = () => {
  if (
    process.env.ENABLE_RESERVATION_EXPIRATION_JOB === "false"
  ) {
    logJobInfo("Job deshabilitado por configuración.");
    return;
  }

  /*
   * Se valida la expresión antes de registrar el job.
   * Esto evita iniciar el servidor con una configuración cron
   * inválida que nunca llegaría a ejecutarse correctamente.
   */
  if (
    !cron.validate(RESERVATION_EXPIRATION_CRON_EXPRESSION)
  ) {
    throw new Error(
      `Expresión cron inválida: ${RESERVATION_EXPIRATION_CRON_EXPRESSION}`,
    );
  }

  cron.schedule(
    RESERVATION_EXPIRATION_CRON_EXPRESSION,
    async () => {
      try {
        await procesarReservasVencidasJob();
      } catch (error) {
        logJobError(error);
      }
    },
    {
      timezone: RESERVATION_EXPIRATION_TIME_ZONE,
    },
  );

  logJobInfo(
    `Job inicializado correctamente con expresión ${RESERVATION_EXPIRATION_CRON_EXPRESSION} y zona horaria ${RESERVATION_EXPIRATION_TIME_ZONE}.`,
  );
};