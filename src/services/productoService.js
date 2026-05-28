import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/**
 * Obtiene productos registrados permitiendo búsqueda opcional
 * para facilitar la gestión administrativa del inventario.
 */
export const obtenerProductos = async (search = "") => {
  // Elimina espacios sobrantes enviados en la búsqueda.
  const searchNormalizado = search.trim();

  // Convierte búsqueda a mayúsculas para comparar enums.
  const searchEnum = searchNormalizado.toUpperCase();

  // Si existe búsqueda, inicialmente se busca por campos de texto.
  const filtros = searchNormalizado
    ? [
        // Permite buscar coincidencias parciales por nombre.
        {
          nombre: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },

        // Permite buscar coincidencias parciales por descripción.
        {
          descripcion: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      ]
    : [];

  // Si la búsqueda coincide con tipos válidos,
  // agrega filtro por tipo de producto.
  if (["FLOR", "SEMILLA"].includes(searchEnum)) {
    filtros.push({
      tipo: {
        equals: searchEnum,
      },
    });
  }

  // Si la búsqueda coincide con genéticas válidas,
  // agrega filtro por genética.
  if (["INDICA", "SATIVA", "HIBRIDA"].includes(searchEnum)) {
    filtros.push({
      genetica: {
        equals: searchEnum,
      },
    });
  }

  // Si la búsqueda coincide con estados válidos,
  // agrega filtro por estado.
  if (["ACTIVO", "INACTIVO"].includes(searchEnum)) {
    filtros.push({
      estado: {
        equals: searchEnum,
      },
    });
  }

  // Consulta productos aplicando filtros opcionales.
  const productos = await prisma.producto.findMany({
    // Si existen filtros se aplican.
    // Si no existen, retorna todos los productos.
    where: filtros.length > 0 ? { OR: filtros } : undefined,

    // Incluye información de stock asociada.
    include: {
      stock: true,
    },

    // Ordena resultados por identificador ascendente.
    orderBy: {
      id: "asc",
    },
  });

  return productos;
};
/*
  Determina automáticamente la unidad de medida según el tipo de producto.

  Reglas de negocio:
  - Los productos de tipo FLOR se gestionan en GRAMOS.
  - Los productos de tipo SEMILLA se gestionan en UNIDADES.
*/
const obtenerUnidadMedidaPorTipo = (tipo) => {
  if (tipo === "FLOR") {
    return "GRAMOS";
  }

  if (tipo === "SEMILLA") {
    return "UNIDADES";
  }

  throw new AppError("Tipo de producto inválido", 400);
};

export const crearProducto = async (datosProducto) => {
  const {
    nombre,
    descripcion,
    tipo,
    genetica,
    porcentaje_thc,
    precio_venta_actual,
  } = datosProducto;

  const productoExistente = await prisma.producto.findFirst({
    where: {
      nombre: {
        equals: nombre,
        mode: "insensitive",
      },
    },
  });

  if (productoExistente) {
    throw new AppError("Ya existe un producto registrado con ese nombre", 400);
  }

  const unidad_medida = obtenerUnidadMedidaPorTipo(tipo);

  if (!genetica) {
    throw new AppError("La genética del producto es obligatoria", 400);
  }

  if (tipo === "FLOR") {
    if (
      porcentaje_thc === undefined ||
      porcentaje_thc === null ||
      Number.isNaN(Number(porcentaje_thc)) ||
      Number(porcentaje_thc) <= 0 ||
      Number(porcentaje_thc) > 100
    ) {
      throw new AppError(
        "El porcentaje de THC debe ser un número entre 1 y 100 para productos de tipo FLOR",
        400,
      );
    }
  }

  if (
    tipo === "SEMILLA" &&
    porcentaje_thc !== undefined &&
    porcentaje_thc !== null
  ) {
    throw new AppError(
      "Los productos de tipo SEMILLA no deben registrar porcentaje de THC",
      400,
    );
  }

  const nuevoProducto = await prisma.producto.create({
    data: {
      nombre,
      descripcion,
      tipo,
      genetica,
      porcentaje_thc,
      unidad_medida,
      precio_venta_actual,
      stock: {
        create: {},
      },
    },
    include: {
      stock: true,
    },
  });

  return nuevoProducto;
};

// Valida que el id recibido sea un número entero positivo.
const validarIdProducto = (id) => {
  const productoId = Number(id);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El id del producto es inválido", 400);
  }

  return productoId;
};

// Busca un producto por id y verifica que exista en la base de datos.
const obtenerProductoPorId = async (productoId) => {
  const productoExistente = await prisma.producto.findUnique({
    where: { id: productoId },
  });

  if (!productoExistente) {
    throw new AppError("El producto indicado no existe", 404);
  }

  return productoExistente;
};

// Valida que el nombre del producto no esté vacío
// y que no exista otro producto registrado con el mismo nombre.
const validarNombreProducto = async (nombre, productoId) => {
  if (nombre !== undefined && !nombre.trim()) {
    throw new AppError("El nombre del producto es obligatorio", 400);
  }

  if (nombre !== undefined) {
    const productoDuplicado = await prisma.producto.findFirst({
      where: {
        nombre: {
          equals: nombre,
          mode: "insensitive",
        },
        NOT: {
          id: productoId,
        },
      },
    });

    if (productoDuplicado) {
      throw new AppError(
        "Ya existe otro producto registrado con ese nombre",
        409,
      );
    }
  }
};

// Verifica que el tipo del producto no pueda modificarse luego de creado.
const validarTipoInmutable = (tipo, productoExistente) => {
  if (tipo !== undefined && tipo !== productoExistente.tipo) {
    throw new AppError(
      "No se puede modificar el tipo de un producto existente",
      400,
    );
  }
};

// Define la genética final del producto.
// Si no se envía una nueva genética, conserva la genética actual.
const obtenerGeneticaFinal = (genetica, productoExistente) => {
  const geneticaFinal = genetica ?? productoExistente.genetica;

  if (!geneticaFinal) {
    throw new AppError("La genética del producto es obligatoria", 400);
  }

  return geneticaFinal;
};

// Define y valida el porcentaje de THC final según el tipo de producto.
const obtenerPorcentajeThcFinal = (
  datosProducto,
  productoExistente,
  tipoFinal,
) => {
  let porcentajeThcFinal = productoExistente.porcentaje_thc;

  if (Object.prototype.hasOwnProperty.call(datosProducto, "porcentaje_thc")) {
    porcentajeThcFinal = datosProducto.porcentaje_thc;
  }

  if (tipoFinal === "FLOR") {
    const thcNumerico = Number(porcentajeThcFinal);

    if (
      porcentajeThcFinal === null ||
      porcentajeThcFinal === undefined ||
      Number.isNaN(thcNumerico) ||
      thcNumerico <= 0 ||
      thcNumerico > 100
    ) {
      throw new AppError(
        "El porcentaje de THC debe ser un número entre 1 y 100 para productos de tipo FLOR",
        400,
      );
    }

    return thcNumerico;
  }

  if (tipoFinal === "SEMILLA") {
    if (porcentajeThcFinal !== null && porcentajeThcFinal !== undefined) {
      throw new AppError(
        "Los productos de tipo SEMILLA no deben registrar porcentaje de THC",
        400,
      );
    }

    return null;
  }

  return porcentajeThcFinal;
};

// Valida el precio de venta si fue enviado en la actualización.
const validarPrecioProducto = (precio_venta_actual) => {
  if (
    precio_venta_actual !== undefined &&
    (Number.isNaN(Number(precio_venta_actual)) ||
      Number(precio_venta_actual) <= 0)
  ) {
    throw new AppError("El precio de venta debe ser mayor a cero", 400);
  }
};

// Valida que el producto no se encuentre previamente inactivo.
// Evita ejecutar una baja lógica repetida sobre el mismo registro.
const validarProductoActivo = (productoExistente) => {
  if (productoExistente.estado === "INACTIVO") {
    throw new AppError("El producto ya se encuentra inactivo", 400);
  }
};

export const actualizarProducto = async (id, datosProducto) => {
  const productoId = validarIdProducto(id);

  const productoExistente = await obtenerProductoPorId(productoId);

  const { nombre, descripcion, tipo, genetica, precio_venta_actual } =
    datosProducto;

  validarTipoInmutable(tipo, productoExistente);

  const tipoFinal = productoExistente.tipo;
  const unidadMedida = productoExistente.unidad_medida;

  await validarNombreProducto(nombre, productoId);

  const geneticaFinal = obtenerGeneticaFinal(genetica, productoExistente);

  const porcentajeThcFinal = obtenerPorcentajeThcFinal(
    datosProducto,
    productoExistente,
    tipoFinal,
  );

  validarPrecioProducto(precio_venta_actual);

  return prisma.producto.update({
    where: { id: productoId },
    data: {
      nombre,
      descripcion,
      genetica: geneticaFinal,
      porcentaje_thc: porcentajeThcFinal,
      unidad_medida: unidadMedida,
      precio_venta_actual:
        precio_venta_actual !== undefined
          ? Number(precio_venta_actual)
          : productoExistente.precio_venta_actual,
    },
    include: {
      stock: true,
    },
  });
};

export const desactivarProducto = async (id) => {
  const productoId = validarIdProducto(id);

  const productoExistente = await obtenerProductoPorId(productoId);

  validarProductoActivo(productoExistente);

  return prisma.producto.update({
    where: { id: productoId },
    data: {
      estado: "INACTIVO",
    },
    include: {
      stock: true,
    },
  });
};
