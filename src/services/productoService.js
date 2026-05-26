import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";

/**
 * Obtiene todos los productos registrados en el sistema.
 * Incluye el stock asociado para mostrar información de inventario.
 */
export const obtenerProductos = async () => {
  const productos = await prisma.producto.findMany({
    include: {
      stock: true,
    },
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

  Esta lógica queda centralizada en el backend para evitar que el frontend
  o Postman puedan enviar una unidad de medida incorrecta.
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
  // Extrae los datos necesarios enviados desde el controller.
  const {
    nombre,
    descripcion,
    tipo,
    genetica,
    porcentaje_thc,
    precio_venta_actual,
  } = datosProducto;

  // Verifica si ya existe un producto con el mismo nombre.
  // Se utiliza comparación case insensitive para evitar duplicados
  // como "Cannabis" y "cannabis".
  const productoExistente = await prisma.producto.findFirst({
    where: {
      nombre: {
        equals: nombre,
        mode: "insensitive",
      },
    },
  });

  // Si ya existe un producto con ese nombre, se interrumpe el proceso.
  if (productoExistente) {
    throw new AppError(
      "Ya existe un producto registrado con ese nombre",
      400,
    );
  }

  // Determina automáticamente la unidad de medida
  // según el tipo de producto seleccionado.
  const unidad_medida = obtenerUnidadMedidaPorTipo(tipo);

  // Valida reglas específicas según el tipo de producto.
  // Las flores deben tener genética y porcentaje de THC.
  // Las semillas deben tener genética, pero no porcentaje de THC.
  if (!genetica) {
    throw new AppError(
      "La genética del producto es obligatoria",
      400,
    );
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

  // Crea el producto junto con su registro de stock asociado.
  // Prisma permite crear relaciones anidadas utilizando create.
  const nuevoProducto = await prisma.producto.create({
    data: {
      nombre,
      descripcion,
      tipo,
      genetica,
      porcentaje_thc,
      unidad_medida,
      precio_venta_actual,

      // Se crea automáticamente el stock inicial del producto.
      // Los valores quedan inicializados en cero utilizando
      // los defaults definidos en el modelo Stock.
      stock: {
        create: {},
      },
    },

    // Incluye la información de stock en la respuesta.
    include: {
      stock: true,
    },
  });

  // Retorna el producto creado.
  return nuevoProducto;
};