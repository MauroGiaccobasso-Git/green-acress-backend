import { Client } from "pg";
import { assertTestEnvironment } from "./assertTestEnvironment.js";

/* =========================================================
   PREPARACIÓN SEGURA DE LA BASE DE TESTING
========================================================= */

/*
  Este script crea la base de testing solamente si no existe.

  No elimina bases.
  No borra tablas.
  No ejecuta migraciones.
  No modifica la base habitual del proyecto.
*/

const prepareTestDatabase = async () => {
  const { databaseName } = assertTestEnvironment();
  const testDatabaseUrl = new URL(process.env.DATABASE_URL);

  // Protección adicional contra nombres manipulados.
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error(
      "El nombre de la base de testing contiene caracteres inválidos.",
    );
  }

  /*
    Para crear una base debemos conectarnos primero a una base
    administrativa existente. Usamos `postgres` con las mismas
    credenciales configuradas en .env.test.
  */
  const adminDatabaseUrl = new URL(testDatabaseUrl.toString());

  adminDatabaseUrl.pathname = "/postgres";
  adminDatabaseUrl.searchParams.delete("schema");

  const client = new Client({
    connectionString: adminDatabaseUrl.toString(),
  });

  try {
    await client.connect();

    const existingDatabase = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (existingDatabase.rowCount > 0) {
      console.log(`La base de testing "${databaseName}" ya existe.`);
      return;
    }

    await client.query(`CREATE DATABASE "${databaseName}"`);

    console.log(`Base de testing "${databaseName}" creada correctamente.`);
  } finally {
    await client.end();
  }
};

prepareTestDatabase().catch((error) => {
  console.error(`No se pudo preparar la base de testing: ${error.message}`);
  process.exitCode = 1;
});