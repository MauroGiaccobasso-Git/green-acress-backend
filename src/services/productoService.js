import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { registrarAuditoria } from "./auditoriaService.js";

/* =========================================================
   SELECTORES SEGUROS
========================================================= */

// Campos permitidos para el catálogo del Portal de Socios.
// El identificador se utiliza únicamente para construir la solicitud
// de reserva y no debe mostrarse visualmente en la interfaz.
const productoPortalSocioSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  imagen_url: true,
  genetica: true,
  porcentaje_thc: true,
  precio_venta_actual: true,
  stock: {
    select: {
      cantidad_disponible: true,
    },
  },
};

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

// Convierte y valida el usuario administrador responsable.
const validarIdUsuario = (id) => {
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario administrador es obligatorio", 400);
  }

  return usuarioId;
};

// Normaliza y valida los parámetros de paginación administrativa.
const validarPaginacion = (page, limit) => {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  return {
    page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    limit:
      Number.isInteger(limitNumber) && limitNumber > 0 && limitNumber <= 50
        ? limitNumber
        : 10,
  };
};

// Normaliza los valores recibidos tanto desde JSON como desde formularios
// multipart/form-data. Los campos numéricos enviados vacíos por FormData
// se convierten en null para conservar las reglas de negocio existentes.
const normalizarTexto = (valor) => {
  if (typeof valor !== "string") {
    return valor;
  }

  return valor.trim();
};

const normalizarTextoOpcional = (valor) => {
  if (valor === undefined || valor === null) {
    return valor;
  }

  if (typeof valor !== "string") {
    return valor;
  }

  const textoNormalizado = valor.trim();

  return textoNormalizado || null;
};

const normalizarNumeroOpcional = (valor) => {
  if (typeof valor === "string" && !valor.trim()) {
    return null;
  }

  return valor;
};

const normalizarDatosProducto = (datosProducto = {}) => ({
  ...datosProducto,
  nombre: normalizarTexto(datosProducto.nombre),
  descripcion: normalizarTextoOpcional(datosProducto.descripcion),
  imagen_url: normalizarTextoOpcional(datosProducto.imagen_url),
  tipo: normalizarTexto(datosProducto.tipo),
  genetica: normalizarTexto(datosProducto.genetica),
  porcentaje_thc: normalizarNumeroOpcional(datosProducto.porcentaje_thc),
  precio_venta_actual: normalizarNumeroOpcional(
    datosProducto.precio_venta_actual,
  ),
});

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
const obtenerProductoPorId = async (productoId, tx = prisma) => {
  const productoExistente = await tx.producto.findUnique({
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
const validarNombreProducto = async (
  { nombre, productoId = null, obligatorio = false },
  tx = prisma,
) => {
  if (obligatorio && (nombre === undefined || nombre === null)) {
    throw new AppError("El nombre del producto es obligatorio", 400);
  }

  if (nombre === undefined) {
    return;
  }

  if (typeof nombre !== "string" || !nombre.trim()) {
    throw new AppError("El nombre del producto es obligatorio", 400);
  }

  const productoDuplicado = await tx.producto.findFirst({
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

// Valida que el precio de venta exista y sea mayor a cero.
const validarPrecioProducto = (precioVentaActual) => {
  if (
    precioVentaActual === undefined ||
    precioVentaActual === null ||
    Number.isNaN(Number(precioVentaActual)) ||
    Number(precioVentaActual) <= 0
  ) {
    throw new AppError("El precio de venta debe ser mayor a cero", 400);
  }
};

/* =========================================================
   HELPERS DE FILTROS
========================================================= */

// Construye el where administrativo de productos.
// El buscador se limita a texto libre, mientras que
// tipo, estado y genética se aplican como filtros exactos.
const construirWhereProductos = ({
  search = "",
  tipo,
  estado,
  genetica,
} = {}) => {
  const filtros = [];

  const searchNormalizado = search.trim();

  if (searchNormalizado) {
    filtros.push({
      OR: [
        {
          nombre: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
        {
          descripcion: {
            contains: searchNormalizado,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (tipo) {
    filtros.push({ tipo });
  }

  if (estado) {
    filtros.push({ estado });
  }

  if (genetica) {
    filtros.push({ genetica });
  }

  return filtros.length > 0 ? { AND: filtros } : undefined;
};

/* =========================================================
   HELPERS DE TRANSFORMACIÓN
========================================================= */

// Determina automáticamente la unidad de medida según el tipo de producto.
const obtenerUnidadMedidaPorTipo = (tipo) => {
  if (tipo === "FLOR") {
    return "GRAMOS";
  }

  if (tipo === "SEMILLA") {
    return "UNIDADES";
  }

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

// Construye los datos finales necesarios para registrar un producto.
const construirDatosCreacionProducto = (datosProducto) => {
  const {
    nombre,
    descripcion,
    imagen_url,
    tipo,
    genetica,
    porcentaje_thc,
    precio_venta_actual,
  } = datosProducto;

  const unidadMedida = obtenerUnidadMedidaPorTipo(tipo);

  if (!genetica) {
    throw new AppError("Genética obligatoria", 400);
  }

  if (tipo === "FLOR") {
    const thcNumerico = Number(porcentaje_thc);

    if (
      porcentaje_thc === undefined ||
      porcentaje_thc === null ||
      Number.isNaN(thcNumerico) ||
      thcNumerico <= 0 ||
      thcNumerico > 100
    ) {
      throw new AppError("THC inválido", 400);
    }

    validarPrecioProducto(precio_venta_actual);
  }

  if (tipo === "SEMILLA") {
    if (porcentaje_thc !== null && porcentaje_thc !== undefined) {
      throw new AppError("SEMILLA no permite THC", 400);
    }

    if (precio_venta_actual !== null && precio_venta_actual !== undefined) {
      throw new AppError("SEMILLA no debe registrar precio de venta", 400);
    }
  }

  return {
    nombre,
    descripcion,
    imagen_url,
    tipo,
    genetica,
    porcentaje_thc: tipo === "FLOR" ? Number(porcentaje_thc) : null,
    unidad_medida: unidadMedida,
    precio_venta_actual: tipo === "FLOR" ? Number(precio_venta_actual) : null,
  };
};

// Construye los datos finales necesarios para actualizar un producto.
const construirDatosActualizacionProducto = (
  datosProducto,
  productoExistente,
) => {
  const { nombre, descripcion, imagen_url, genetica, precio_venta_actual } =
    datosProducto;

  const tipoFinal = productoExistente.tipo;

  const geneticaFinal = obtenerGeneticaFinal(genetica, productoExistente);

  const porcentajeThcFinal = obtenerPorcentajeThcFinal(
    datosProducto,
    productoExistente,
    tipoFinal,
  );

  // El precio de venta solo aplica a productos tipo FLOR.
  // Para SEMILLA se conserva siempre en null porque no se comercializa a socios.
  let precioVentaFinal = productoExistente.precio_venta_actual;

  if (tipoFinal === "FLOR" && precio_venta_actual !== undefined) {
    validarPrecioProducto(precio_venta_actual);
    precioVentaFinal = Number(precio_venta_actual);
  }

  if (tipoFinal === "SEMILLA") {
    if (precio_venta_actual !== null && precio_venta_actual !== undefined) {
      throw new AppError("SEMILLA no debe registrar precio de venta", 400);
    }

    precioVentaFinal = null;
  }

  return {
    nombre,
    descripcion,
    imagen_url,
    genetica: geneticaFinal,
    porcentaje_thc: porcentajeThcFinal,
    unidad_medida: productoExistente.unidad_medida,
    precio_venta_actual: precioVentaFinal,
  };
};

// Construye el contrato público utilizado por el Portal de Socios.
const transformarProductoPortalSocio = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  genetica: producto.genetica,
  porcentajeThc: Number(producto.porcentaje_thc),
  descripcion: producto.descripcion,
  precioPorGramo: Number(producto.precio_venta_actual),
  imagen: producto.imagen_url,
  cantidadDisponible: Number(producto.stock.cantidad_disponible),
});

/* =========================================================
   HELPERS DE PERSISTENCIA
========================================================= */

// Registra el producto junto con su stock inicial.
const crearProductoPersistencia = async (datosProducto, tx) => {
  return tx.producto.create({
    data: {
      ...datosProducto,
      stock: {
        create: {},
      },
    },
    include: {
      stock: true,
    },
  });
};

// Actualiza únicamente los datos editables del producto.
const actualizarProductoPersistencia = async (
  productoId,
  datosProducto,
  tx,
) => {
  return tx.producto.update({
    where: {
      id: productoId,
    },
    data: datosProducto,
    include: {
      stock: true,
    },
  });
};

// Actualiza el estado lógico del producto.
const actualizarEstadoProductoPersistencia = async (
  productoId,
  nuevoEstado,
  tx,
) => {
  return tx.producto.update({
    where: {
      id: productoId,
    },
    data: {
      estado: nuevoEstado,
    },
    include: {
      stock: true,
    },
  });
};

/* =========================================================
   OPERACIONES INTERNAS
========================================================= */

// Registra auditoría administrativa por alta de producto.
const auditarCreacionProducto = async ({ usuarioId, producto }, tx) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CREAR_PRODUCTO",
      entidad: "Producto",
      entidadId: producto.id,
      detalle: `Producto ${producto.nombre} creado como ${producto.tipo}.`,
    },
    tx,
  );
};

// Registra auditoría administrativa por modificación de producto.
const auditarModificacionProducto = async ({ usuarioId, producto }, tx) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "ACTUALIZAR_PRODUCTO",
      entidad: "Producto",
      entidadId: producto.id,
      detalle: `Producto ${producto.nombre} actualizado.`,
    },
    tx,
  );
};

// Registra auditoría administrativa por cambio de estado.
const auditarCambioEstadoProducto = async (
  { usuarioId, producto, estadoAnterior },
  tx,
) => {
  await registrarAuditoria(
    {
      usuarioId,
      accion: "CAMBIAR_ESTADO_PRODUCTO",
      entidad: "Producto",
      entidadId: producto.id,
      detalle: `Producto ${producto.nombre} cambió de ${estadoAnterior} a ${producto.estado}.`,
    },
    tx,
  );
};

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

export const getProductos = async ({
  search = "",
  tipo,
  estado,
  genetica,
  page = 1,
  limit = 10,
} = {}) => {
  const paginacion = validarPaginacion(page, limit);

  const where = construirWhereProductos({
    search,
    tipo,
    estado,
    genetica,
  });

  const skip = (paginacion.page - 1) * paginacion.limit;

  const [productos, total] = await prisma.$transaction([
    prisma.producto.findMany({
      where,
      include: {
        stock: true,
      },
      orderBy: [
        {
          estado: "asc",
        },
        {
          fecha_creacion: "desc",
        },
      ],
      skip,
      take: paginacion.limit,
    }),
    prisma.producto.count({
      where,
    }),
  ]);

  return {
    data: productos,
    pagination: {
      page: paginacion.page,
      limit: paginacion.limit,
      total,
      totalPages: Math.ceil(total / paginacion.limit),
    },
  };
};

/* =========================================================
   CONSULTAS OPERATIVAS
========================================================= */

// Obtiene las flores habilitadas para ser utilizadas en el registro de ventas.
// La consulta aplica desde backend las reglas operativas de disponibilidad
// y devuelve únicamente los datos requeridos por el selector.
export const getOpcionesProductosVenta = async () => {
  const productos = await prisma.producto.findMany({
    where: {
      tipo: "FLOR",
      estado: "ACTIVO",
      precio_venta_actual: {
        gt: 0,
      },
      stock: {
        is: {
          cantidad_disponible: {
            gt: 0,
          },
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      porcentaje_thc: true,
      precio_venta_actual: true,
      stock: {
        select: {
          cantidad_disponible: true,
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
  });

  return productos.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
    porcentaje_thc: producto.porcentaje_thc,
    precio: producto.precio_venta_actual,
    stockDisponible: producto.stock.cantidad_disponible,
  }));
};

// Obtiene las semillas habilitadas para ser utilizadas en el registro de compras.
// La consulta conserva el comportamiento actual del selector administrativo,
// mostrando únicamente semillas activas y un contrato reducido.
export const getOpcionesProductosCompra = async () => {
  const productos = await prisma.producto.findMany({
    where: {
      tipo: "SEMILLA",
    },
    select: {
      id: true,
      nombre: true,
      estado: true,
      genetica: true,
      imagen_url: true,
      stock: {
        select: {
          cantidad_disponible: true,
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
  });

  return productos.map((producto) => ({
    id: producto.id,
    nombre: producto.nombre,
    estado: producto.estado,
    genetica: producto.genetica,
    imagen: producto.imagen_url,
    stock: producto.stock.cantidad_disponible,
  }));
};

/* =========================================================
   CONSULTAS DEL PORTAL DE SOCIOS
========================================================= */

// Obtiene el catálogo público disponible para reservas.
// Solo expone flores activas con precio válido y disponibilidad real mayor a cero.
export const getProductosPortalSocio = async () => {
  const productos = await prisma.producto.findMany({
    where: {
      tipo: "FLOR",
      estado: "ACTIVO",
      precio_venta_actual: {
        gt: 0,
      },
      stock: {
        is: {
          cantidad_disponible: {
            gt: 0,
          },
        },
      },
    },
    select: productoPortalSocioSelect,
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
  });

  return productos.map(transformarProductoPortalSocio);
};

/* =========================================================
   OPERACIONES DEL MÓDULO
========================================================= */

export const crearProducto = async ({ datosProducto, usuarioId }) => {
  const idUsuario = validarIdUsuario(usuarioId);
  const datosNormalizados = normalizarDatosProducto(datosProducto);

  return prisma.$transaction(async (tx) => {
    await validarNombreProducto(
      {
        nombre: datosNormalizados.nombre,
        obligatorio: true,
      },
      tx,
    );

    const datosCreacion = construirDatosCreacionProducto(datosNormalizados);

    const producto = await crearProductoPersistencia(datosCreacion, tx);

    await auditarCreacionProducto(
      {
        usuarioId: idUsuario,
        producto,
      },
      tx,
    );

    return producto;
  });
};

export const actualizarProducto = async ({
  productoId,
  datosProducto,
  usuarioId,
}) => {
  const idProducto = validarIdProducto(productoId);
  const idUsuario = validarIdUsuario(usuarioId);
  const datosNormalizados = normalizarDatosProducto(datosProducto);

  return prisma.$transaction(async (tx) => {
    const productoExistente = await obtenerProductoPorId(idProducto, tx);

    validarTipoInmutable(datosNormalizados.tipo, productoExistente);

    await validarNombreProducto(
      {
        nombre: datosNormalizados.nombre,
        productoId: idProducto,
      },
      tx,
    );

    const datosActualizacion = construirDatosActualizacionProducto(
      datosNormalizados,
      productoExistente,
    );

    const producto = await actualizarProductoPersistencia(
      idProducto,
      datosActualizacion,
      tx,
    );

    await auditarModificacionProducto(
      {
        usuarioId: idUsuario,
        producto,
      },
      tx,
    );

    return {
      producto,
      imagenAnteriorUrl: productoExistente.imagen_url,
    };
  });
};

export const actualizarEstadoProducto = async ({
  productoId,
  nuevoEstado,
  usuarioId,
}) => {
  const idProducto = validarIdProducto(productoId);
  const idUsuario = validarIdUsuario(usuarioId);

  return prisma.$transaction(async (tx) => {
    const productoExistente = await obtenerProductoPorId(idProducto, tx);

    validarCambioEstadoProducto(productoExistente, nuevoEstado);

    const producto = await actualizarEstadoProductoPersistencia(
      idProducto,
      nuevoEstado,
      tx,
    );

    await auditarCambioEstadoProducto(
      {
        usuarioId: idUsuario,
        producto,
        estadoAnterior: productoExistente.estado,
      },
      tx,
    );

    return producto;
  });
};
