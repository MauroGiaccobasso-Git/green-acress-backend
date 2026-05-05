// Importa la configuración de variables de entorno desde el archivo .env
// Permite acceder a DATABASE_URL y otras variables necesarias para la conexión
import "dotenv/config";

// Importa la función defineConfig de Prisma
// Esta función se utiliza para definir la configuración del entorno de Prisma
import { defineConfig } from "prisma/config";

// Exporta la configuración principal de Prisma
export default defineConfig({
    // Indica la ubicación del archivo schema.prisma
  // En este archivo se definen los modelos y la estructura de la base de datos
  schema: "prisma/schema.prisma",
  // Configuración de las migraciones
  // Define la carpeta donde Prisma va a guardar los cambios en la base de datos
  migrations: {
    path: "prisma/migrations",
  },
  // Configuración de la conexión a la base de datos
  datasource: {
     // Utiliza la variable de entorno DATABASE_URL definida en el archivo .env
    // para establecer la conexión con PostgreSQL
    url: process.env["DATABASE_URL"],
  },
});
