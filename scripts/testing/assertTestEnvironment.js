import { pathToFileURL } from "node:url";

/* =========================================================
   PROTECCIÓN DEL ENTORNO DE TESTING
========================================================= */

/*
  Verifica que cualquier prueba destructiva o de concurrencia
  se ejecute exclusivamente sobre una base separada.

  Este control NO crea bases, NO ejecuta migraciones y
  NO modifica datos.

  Solo revisa:

  - NODE_ENV debe ser test;
  - DATABASE_URL debe ser válida;
  - el nombre de la base debe terminar en _test;
  - el job automático de vencimientos debe estar apagado.
*/
export const assertTestEnvironment = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "ENTORNO DE TESTING RECHAZADO: NODE_ENV debe ser test.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "ENTORNO DE TESTING RECHAZADO: DATABASE_URL no está configurada.",
    );
  }

  let parsedDatabaseUrl;

  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "ENTORNO DE TESTING RECHAZADO: DATABASE_URL no es válida.",
    );
  }

  const databaseName = decodeURIComponent(
    parsedDatabaseUrl.pathname.replace(/^\/+/, ""),
  );

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `ENTORNO DE TESTING RECHAZADO: la base "${databaseName}" no termina en "_test".`,
    );
  }

  if (process.env.ENABLE_RESERVATION_EXPIRATION_JOB !== "false") {
    throw new Error(
      "ENTORNO DE TESTING RECHAZADO: ENABLE_RESERVATION_EXPIRATION_JOB debe ser false.",
    );
  }

  return {
    databaseName,
    host: parsedDatabaseUrl.hostname,
  };
};

/*
  Permite ejecutar este archivo directamente desde la terminal
  para comprobar la configuración sin conectarse a PostgreSQL.
*/
const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const environment = assertTestEnvironment();

  console.log(
    `Entorno de testing seguro: ${environment.databaseName} en ${environment.host}`,
  );
}