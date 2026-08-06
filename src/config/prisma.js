// Importa las variables de entorno definidas en el archivo .env.
import "dotenv/config";

// Importa PrismaClient desde @prisma/client.
import { PrismaClient } from "@prisma/client";

// Importa el adapter de PostgreSQL requerido por Prisma 7.
import { PrismaPg } from "@prisma/adapter-pg";

// Obtiene la URL de conexión desde las variables de entorno.
const databaseUrl = process.env.DATABASE_URL?.trim();

// Impide iniciar el backend si falta la conexión a PostgreSQL.
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL no está configurada. El backend no puede conectarse a PostgreSQL.",
  );
}

// Detecta si la conexión apunta a AWS RDS.
// AWS necesita SSL, PostgreSQL local no.
const isAwsRds = databaseUrl.includes("amazonaws.com");

// Configura el adapter según el entorno actual.
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  ...(isAwsRds && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
});

// Crea una instancia única de Prisma Client usando el adapter.
const prisma = new PrismaClient({
  adapter,
  ...(isAwsRds && {
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
    },
  }),
});

// Exporta Prisma para reutilizarlo en services, controllers y helpers.
export default prisma;
