import cron from "node-cron";

import { vencerReservasExpiradas } from "../services/reservaService.js";

/* =========================================================
   CONSTANTES DEL JOB
========================================================= */

const RESERVATION_EXPIRATION_JOB_NAME = "ReservationExpirationJob";

/*
  Ejecuta todos los días a las 00:05.

  Se agenda unos minutos después de medianoche para evitar correr exactamente
  en el cambio de día y dejar margen ante pequeñas demoras del entorno.
*/
const RESERVATION_EXPIRATION_CRON_EXPRESSION =
  process.env.RESERVATION_EXPIRATION_CRON || "5 0 * * *";

/* =========================================================
   HELPERS
========================================================= */

const logJobInfo = (message) => {
  console.log(`[${RESERVATION_EXPIRATION_JOB_NAME}] ${message}`);
};

const logJobError = (error) => {
  console.error(
    `[${RESERVATION_EXPIRATION_JOB_NAME}] Error al procesar reservas vencidas:`,
    error,
  );
};

/* =========================================================
   FUNCIÓN DEL JOB
========================================================= */

const procesarReservasVencidasJob = async () => {
  logJobInfo("Inicio del procesamiento automático de reservas vencidas.");

  const resultado = await vencerReservasExpiradas();

  logJobInfo(
    `Procesamiento finalizado. Reservas vencidas procesadas: ${resultado.cantidadProcesada}.`,
  );
};

/* =========================================================
   INICIALIZACIÓN DEL JOB
========================================================= */

export const iniciarReservationExpirationJob = () => {
  if (process.env.ENABLE_RESERVATION_EXPIRATION_JOB === "false") {
    logJobInfo("Job deshabilitado por configuración.");
    return;
  }

  cron.schedule(RESERVATION_EXPIRATION_CRON_EXPRESSION, async () => {
    try {
      await procesarReservasVencidasJob();
    } catch (error) {
      logJobError(error);
    }
  });

  logJobInfo(
    `Job inicializado correctamente con expresión: ${RESERVATION_EXPIRATION_CRON_EXPRESSION}`,
  );
};