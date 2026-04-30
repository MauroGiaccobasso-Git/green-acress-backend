// Importa la clase PrismaClient desde la librería @prisma/client
// Esta clase permite crear una conexión entre el backend y la base de datos utilizando Prisma ORM
import { PrismaClient } from '@prisma/client';

// Crea una instancia del cliente Prisma
// Esta instancia será utilizada para realizar consultas a la base de datos
// a través de los modelos definidos en el archivo schema.prisma
const prisma = new PrismaClient();

// Exporta la instancia de Prisma para que pueda ser utilizada en otros módulos del backend,
// como servicios o controladores, permitiendo interactuar con la base de datos desde distintas partes del sistema
export default prisma;