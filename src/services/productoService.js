import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   VALIDACIONES GENERALES
========================================================= */

// Convierte y valida el identificador recibido.
const validarIdProducto = (id) => {
  const productoId = Number(id);

  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw new AppError("El id del producto es inválido", 400);
  }

  return productoId;
};

// Valida que el estado solicitado sea permitido
// y que no coincida con el estado actual.
const validarCambioEstadoProducto = (productoExistente, nuevoEstado) => {
  const estadosValidos = ["ACTIVO", "INACTIVO"];

  if (!estadosValidos.includes(nuevoEstado)) {
    throw new AppError("El estado ingresado no es válido", 400);
  }

  if (productoExistente.estado === nuevoEstado) {
    throw new AppError(
      `El producto ya se encuentra ${nuevoEstado.toLowerCase()}`,
      400,
    );
  }
};

/* =========================================================
   HELPERS DE BÚSQUEDA
========================================================= */

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

/* =========================================================
   VALIDACIONES DE NEGOCIO
========================================================= */

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
        NOT: productoId ? { id: productoId } : undefined,
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

/* =========================================================
   HELPERS DE TRANSFORMACIÓN
========================================================= */

// Determina automáticamente la unidad de medida según el tipo de producto.
const obtenerUnidadMedidaPorTipo = (tipo) => {
  if (tipo === "FLOR") return "GRAMOS";
  if (tipo === "SEMILLA") return "UNIDADES";

  throw new AppError("Tipo de producto inválido", 400);
};

// Define la genética final del producto.
const obtenerGeneticaFinal = (genetica, productoExistente) => {
  const geneticaFinal = genetica ?? productoExistente.genetica;

  if (!geneticaFinal) {
    throw new AppError("La genética del producto es obligatoria", 400);
  }

  return geneticaFinal;
};

// Define y valida el porcentaje de THC final.
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
        "El porcentaje de THC debe ser entre 1 y 100 para FLOR",
        400,
      );
    }

    return thcNumerico;
  }

  if (tipoFinal === "SEMILLA") {
    if (porcentajeThcFinal !== null && porcentajeThcFinal !== undefined) {
      throw new AppError("SEMILLA no debe registrar THC", 400);
    }

    return null;
  }

  return porcentajeThcFinal;
};

/* =========================================================
   CRUD PRINCIPAL
========================================================= */

export const getProductos = async (search = "") => {
  const searchNormalizado = search.trim();
  const searchEnum = searchNormalizado.toUpperCase();

  const filtros = searchNormalizado
    ? [
        {
          nombre: { contains: searchNormalizado, mode: "insensitive" },
        },
        {
          descripcion: { contains: searchNormalizado, mode: "insensitive" },
        },
      ]
    : [];

  if (["FLOR", "SEMILLA"].includes(searchEnum)) {
    filtros.push({ tipo: { equals: searchEnum } });
  }

  if (["INDICA", "SATIVA", "HIBRIDA"].includes(searchEnum)) {
    filtros.push({ genetica: { equals: searchEnum } });
  }

  if (["ACTIVO", "INACTIVO"].includes(searchEnum)) {
    filtros.push({ estado: { equals: searchEnum } });
  }

  return prisma.producto.findMany({
    where: filtros.length > 0 ? { OR: filtros } : undefined,
    include: { stock: true },
    orderBy: [{ estado: "asc" }, { fecha_creacion: "desc" }],
  });
};

export const crearProducto = async (datosProducto) => {
  const {
    nombre,
    descripcion,
    imagen_url,
    tipo,
    genetica,
    porcentaje_thc,
    precio_venta_actual,
  } = datosProducto;

  await validarNombreProducto(nombre);

  const unidad_medida = obtenerUnidadMedidaPorTipo(tipo);

  if (!genetica) {
    throw new AppError("Genética obligatoria", 400);
  }

  if (tipo === "FLOR") {
    const thc = Number(porcentaje_thc);

    if (!porcentaje_thc || thc <= 0 || thc > 100) {
      throw new AppError("THC inválido", 400);
    }
  }

  if (tipo === "SEMILLA" && porcentaje_thc != null) {
    throw new AppError("SEMILLA no permite THC", 400);
  }

  validarPrecioProducto(precio_venta_actual);

  return prisma.producto.create({
    data: {
      nombre,
      descripcion,
      imagen_url,
      tipo,
      genetica,
      porcentaje_thc,
      unidad_medida,
      precio_venta_actual,
      stock: { create: {} },
    },
    include: { stock: true },
  });
};

export const actualizarProducto = async (id, datosProducto) => {
  const productoId = validarIdProducto(id);
  const productoExistente = await obtenerProductoPorId(productoId);

  const {
    nombre,
    descripcion,
    imagen_url,
    tipo,
    genetica,
    precio_venta_actual,
  } = datosProducto;

  validarTipoInmutable(tipo, productoExistente);
  await validarNombreProducto(nombre, productoId);
  validarPrecioProducto(precio_venta_actual);

  const tipoFinal = productoExistente.tipo;

  const geneticaFinal = obtenerGeneticaFinal(genetica, productoExistente);

  const porcentajeThcFinal = obtenerPorcentajeThcFinal(
    datosProducto,
    productoExistente,
    tipoFinal,
  );

  return prisma.producto.update({
    where: { id: productoId },
    data: {
      nombre,
      descripcion,
      imagen_url,
      genetica: geneticaFinal,
      porcentaje_thc: porcentajeThcFinal,
      unidad_medida: productoExistente.unidad_medida,
      precio_venta_actual:
        precio_venta_actual ?? productoExistente.precio_venta_actual,
    },
    include: { stock: true },
  });
};

export const actualizarEstadoProducto = async (id, nuevoEstado) => {
  const productoId = validarIdProducto(id);
  const productoExistente = await obtenerProductoPorId(productoId);

  validarCambioEstadoProducto(productoExistente, nuevoEstado);

  return prisma.producto.update({
    where: { id: productoId },
    data: { estado: nuevoEstado },
    include: { stock: true },
  });
};
