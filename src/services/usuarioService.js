// Importa la instancia de Prisma previamente configurada.
// Prisma será el encargado de comunicarse con PostgreSQL.
import prisma from "../config/prisma.js";

// Servicio encargado de obtener usuarios del sistema.
// Este servicio será utilizado desde el controlador.
export const getUsuarios = async (search) => {

  // Se crea dinámicamente el objeto "where".
  // Este objeto permite aplicar filtros a la consulta SQL.
  //
  // Si el parámetro "search" existe:
  // -> se arma un filtro OR para buscar coincidencias.
  //
  // Si NO existe:
  // -> se usa un objeto vacío {}
  // -> Prisma traerá todos los usuarios.
  const where = search
    ? {
        OR: [

          // Busca coincidencias por email.
          // "contains" funciona similar a un LIKE '%texto%'
          // "mode: insensitive" ignora mayúsculas/minúsculas.
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },

          // Busca coincidencias por documento del socio relacionado.
          // Se accede a través de la relación:
          // usuario -> socio -> documento
          {
            socio: {
              documento: {
                contains: search,
                mode: "insensitive",
              },
            },
          },

          // Busca coincidencias por nombre del socio.
          {
            socio: {
              nombre: {
                contains: search,
                mode: "insensitive",
              },
            },
          },

          // Busca coincidencias por apellido del socio.
          {
            socio: {
              apellido: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }

    // Si no existe búsqueda,
    // se deja el filtro vacío para traer todos los registros.
    : {};

  // Consulta a la tabla Usuario utilizando Prisma.
  const usuarios = await prisma.usuario.findMany({

    // Aplica los filtros definidos anteriormente.
    where,

    // "select" permite definir exactamente qué campos retornar.
    // Esto evita exponer información sensible como password_hash.
    select: {

      // Datos principales del usuario
      id: true,
      email: true,
      rol: true,
      estado: true,

      // Información de seguridad/login
      intentos_fallidos: true,
      bloqueado_hasta: true,

      // Fechas de auditoría
      fecha_creacion: true,
      fecha_actualizacion: true,

      // Relación con la tabla Socio.
      // Prisma automáticamente resuelve la relación.
      socio: {
        select: {

          // Datos básicos del socio
          id: true,
          documento: true,
          nombre: true,
          apellido: true,
          estado: true,
        },
      },
    },

    // Ordenamiento de resultados.
    //
    // Primero ordena por apellido.
    // Si hay igualdad, ordena por nombre.
    // Finalmente por id para mantener estabilidad.
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

  // Retorna el resultado al controlador.
  return usuarios;
};