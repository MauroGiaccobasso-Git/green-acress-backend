import prisma from "../config/prisma.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Normaliza búsqueda para evitar inconsistencias.
const normalizarBusqueda = (search) => search.trim();

/* =========================================================
   CRUD PRINCIPAL
========================================================= */

/**
 * Obtiene usuarios del sistema.
 * Permite búsqueda por email o datos del socio asociado.
 * No expone información sensible como password_hash.
 */
export const getUsuarios = async (search = "") => {
  const searchNormalizado = normalizarBusqueda(search);

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

    orderBy: [
      { socio: { apellido: "asc" } },
      { socio: { nombre: "asc" } },
      { id: "asc" },
    ],
  });
};

