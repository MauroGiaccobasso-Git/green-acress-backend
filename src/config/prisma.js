// Importa las variables de entorno definidas en el archivo .env
// Permite acceder a DATABASE_URL desde process.env
import "dotenv/config";

// Importa la clase PrismaClient desde la librería @prisma/client
// Esta clase permite interactuar con la base de datos utilizando Prisma ORM
import { PrismaClient } from "@prisma/client";

// Importa el adapter de PostgreSQL requerido por Prisma 7
// Este adapter es necesario para establecer la conexión con la base de datos
import { PrismaPg } from "@prisma/adapter-pg";

// Configura el adapter con la conexión a PostgreSQL
// Utiliza la variable de entorno DATABASE_URL definida en el archivo .env
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Crea una instancia del cliente Prisma
// Esta instancia será utilizada para realizar consultas a la base de datos
// a través de los modelos definidos en el archivo schema.prisma
// En Prisma 7 se debe pasar el adapter como configuración
const prisma = new PrismaClient({ adapter });

// Exporta la instancia de Prisma para que pueda ser utilizada en otros módulos del backend,
// como services o controllers, permitiendo interactuar con la base de datos desde distintas partes del sistema
export default prisma;