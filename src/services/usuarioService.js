import prisma from "../config/prisma.js";

/**
 * Obtiene usuarios registrados en el sistema.
 * Permite aplicar búsqueda administrativa por email o datos del socio asociado.
 * No expone información sensible como password_hash.
 */
export const getUsuarios = async (search = "") => {
  // Normaliza el criterio de búsqueda para evitar espacios accidentales.
  const searchNormalizado = search.trim();

  // Si se recibe un criterio de búsqueda, se filtra por email
  // o por datos principales del socio asociado al usuario.
  const where = searchNormalizado
    ? {
        OR: [
          {
            email: {
              contains: searchNormalizado,
              mode: "insensitive",
            },
          },
          {
            socio: {
              documento: {
                contains: searchNormalizado,
              },
            },
          },
          {
            socio: {
              nombre: {
                contains: searchNormalizado,
                mode: "insensitive",
              },
            },
          },
          {
            socio: {
              apellido: {
                contains: searchNormalizado,
                mode: "insensitive",
              },
            },
          },
        ],
      }
    : {};

  // Select explícito para controlar qué información devuelve el endpoint
  // y evitar exponer datos sensibles del usuario.
  return prisma.usuario.findMany({
    where,
    select: {
      id: true,
      email: true,
      rol: true,
      estado: true,
      intentos_fallidos: true,
      bloqueado_hasta: true,
      fecha_creacion: true,
      fecha_actualizacion: true,
      socio: {
        select: {
          id: true,
          documento: true,
          nombre: true,
          apellido: true,
          estado: true,
        },
      },
    },

    // Orden estable para que la respuesta sea consistente.
    orderBy: [
      {
        socio: {
          apellido: "asc",
        },
      },
      {
        socio: {
          nombre: "asc",
        },
      },
      {
        id: "asc",
      },
    ],
  });
};