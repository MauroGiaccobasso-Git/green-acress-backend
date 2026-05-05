// Importa la instancia de Prisma previamente configurada
// Esta instancia permite interactuar con la base de datos utilizando los modelos definidos en schema.prisma
import prisma from "../config/prisma.js";

// Servicio encargado de obtener todos los usuarios registrados en la base de datos
// Este método accede al modelo "usuario" definido en Prisma y ejecuta una consulta findMany()
// que retorna un array con todos los registros de la tabla Usuario
export const getUsuarios = async () => {
  return await prisma.usuario.findMany();
};