import prisma from "../../src/config/prisma.js";

/*
Seed de productos para entorno de desarrollo.

Objetivo:
- limpiar productos y stocks existentes;
- cargar 10 flores y 10 semillas;
- generar datos visuales suficientes para probar UI;
- usar imágenes externas estables mediante Picsum;
- permitir evaluar cards, filtros, búsqueda, estados y stock.

Importante:
Este seed es destructivo para productos y stock.
Debe usarse únicamente en entorno local/desarrollo.
*/

const products = [
  {
    nombre: "Amnesia Haze",
    descripcion: "Flor sativa de aroma cítrico, perfil intenso y alta demanda.",
    imagen_url: "https://picsum.photos/seed/amnesia-haze/600/600",
    tipo: "FLOR",
    genetica: "SATIVA",
    porcentaje_thc: 21,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 390,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 120,
      cantidad_reservada: 20,
      cantidad_disponible: 100,
    },
  },
  {
    nombre: "Northern Lights",
    descripcion: "Flor índica clásica, compacta y de aroma herbal suave.",
    imagen_url: "https://picsum.photos/seed/northern-lights/600/600",
    tipo: "FLOR",
    genetica: "INDICA",
    porcentaje_thc: 18,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 360,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 80,
      cantidad_reservada: 15,
      cantidad_disponible: 65,
    },
  },
  {
    nombre: "Blue Dream",
    descripcion: "Flor híbrida equilibrada, dulce y de rotación frecuente.",
    imagen_url: "https://picsum.photos/seed/blue-dream/600/600",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 20,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 380,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 95,
      cantidad_reservada: 25,
      cantidad_disponible: 70,
    },
  },
  {
    nombre: "Gorilla Glue",
    descripcion: "Flor híbrida potente, de aroma terroso y alta concentración.",
    imagen_url: "https://picsum.photos/seed/gorilla-glue/600/600",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 24,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 430,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 60,
      cantidad_reservada: 10,
      cantidad_disponible: 50,
    },
  },
  {
    nombre: "OG Kush",
    descripcion: "Flor híbrida reconocida por su perfil aromático intenso.",
    imagen_url: "https://picsum.photos/seed/og-kush/600/600",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 22,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 410,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 40,
      cantidad_reservada: 35,
      cantidad_disponible: 5,
    },
  },
  {
    nombre: "Critical Mass",
    descripcion: "Flor índica de buena producción y aroma equilibrado.",
    imagen_url: "https://picsum.photos/seed/critical-mass/600/600",
    tipo: "FLOR",
    genetica: "INDICA",
    porcentaje_thc: 17,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 340,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 150,
      cantidad_reservada: 0,
      cantidad_disponible: 150,
    },
  },
  {
    nombre: "Lemon Skunk",
    descripcion: "Flor sativa con notas cítricas marcadas y buena presencia.",
    imagen_url: "https://picsum.photos/seed/lemon-skunk/600/600",
    tipo: "FLOR",
    genetica: "SATIVA",
    porcentaje_thc: 19,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 370,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 35,
      cantidad_reservada: 5,
      cantidad_disponible: 30,
    },
  },
  {
    nombre: "White Widow",
    descripcion: "Flor híbrida histórica, actualmente fuera del catálogo activo.",
    imagen_url: "https://picsum.photos/seed/white-widow/600/600",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 20,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 385,
    estado: "INACTIVO",
    stock: {
      cantidad_total: 0,
      cantidad_reservada: 0,
      cantidad_disponible: 0,
    },
  },
  {
    nombre: "Purple Punch",
    descripcion: "Flor índica de perfil dulce, coloración intensa y stock bajo.",
    imagen_url: "https://picsum.photos/seed/purple-punch/600/600",
    tipo: "FLOR",
    genetica: "INDICA",
    porcentaje_thc: 23,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 420,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 25,
      cantidad_reservada: 20,
      cantidad_disponible: 5,
    },
  },
  {
    nombre: "Sour Diesel",
    descripcion: "Flor sativa de aroma fuerte, actualmente inactiva.",
    imagen_url: "https://picsum.photos/seed/sour-diesel/600/600",
    tipo: "FLOR",
    genetica: "SATIVA",
    porcentaje_thc: 21,
    unidad_medida: "GRAMOS",
    precio_venta_actual: 395,
    estado: "INACTIVO",
    stock: {
      cantidad_total: 10,
      cantidad_reservada: 0,
      cantidad_disponible: 10,
    },
  },
  {
    nombre: "Semilla Amnesia Haze",
    descripcion: "Semilla feminizada de genética sativa.",
    imagen_url: "https://picsum.photos/seed/semilla-amnesia-haze/600/600",
    tipo: "SEMILLA",
    genetica: "SATIVA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 250,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 30,
      cantidad_reservada: 4,
      cantidad_disponible: 26,
    },
  },
  {
    nombre: "Semilla Northern Lights",
    descripcion: "Semilla feminizada de genética índica.",
    imagen_url: "https://picsum.photos/seed/semilla-northern-lights/600/600",
    tipo: "SEMILLA",
    genetica: "INDICA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 230,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 25,
      cantidad_reservada: 5,
      cantidad_disponible: 20,
    },
  },
  {
    nombre: "Semilla Blue Dream",
    descripcion: "Semilla feminizada híbrida de perfil equilibrado.",
    imagen_url: "https://picsum.photos/seed/semilla-blue-dream/600/600",
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 240,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 18,
      cantidad_reservada: 3,
      cantidad_disponible: 15,
    },
  },
  {
    nombre: "Semilla Gorilla Glue",
    descripcion: "Semilla híbrida de genética potente y alta demanda.",
    imagen_url: "https://picsum.photos/seed/semilla-gorilla-glue/600/600",
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 270,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 12,
      cantidad_reservada: 8,
      cantidad_disponible: 4,
    },
  },
  {
    nombre: "Semilla OG Kush",
    descripcion: "Semilla híbrida de genética clásica.",
    imagen_url: "https://picsum.photos/seed/semilla-og-kush/600/600",
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 260,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 22,
      cantidad_reservada: 2,
      cantidad_disponible: 20,
    },
  },
  {
    nombre: "Semilla Critical Mass",
    descripcion: "Semilla índica de alta producción.",
    imagen_url: "https://picsum.photos/seed/semilla-critical-mass/600/600",
    tipo: "SEMILLA",
    genetica: "INDICA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 220,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 40,
      cantidad_reservada: 0,
      cantidad_disponible: 40,
    },
  },
  {
    nombre: "Semilla Lemon Skunk",
    descripcion: "Semilla sativa con perfil cítrico.",
    imagen_url: "https://picsum.photos/seed/semilla-lemon-skunk/600/600",
    tipo: "SEMILLA",
    genetica: "SATIVA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 235,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 16,
      cantidad_reservada: 6,
      cantidad_disponible: 10,
    },
  },
  {
    nombre: "Semilla White Widow",
    descripcion: "Semilla híbrida actualmente fuera del catálogo activo.",
    imagen_url: "https://picsum.photos/seed/semilla-white-widow/600/600",
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 245,
    estado: "INACTIVO",
    stock: {
      cantidad_total: 0,
      cantidad_reservada: 0,
      cantidad_disponible: 0,
    },
  },
  {
    nombre: "Semilla Purple Punch",
    descripcion: "Semilla índica de perfil dulce y stock limitado.",
    imagen_url: "https://picsum.photos/seed/semilla-purple-punch/600/600",
    tipo: "SEMILLA",
    genetica: "INDICA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 255,
    estado: "ACTIVO",
    stock: {
      cantidad_total: 14,
      cantidad_reservada: 10,
      cantidad_disponible: 4,
    },
  },
  {
    nombre: "Semilla Sour Diesel",
    descripcion: "Semilla sativa actualmente inactiva.",
    imagen_url: "https://picsum.photos/seed/semilla-sour-diesel/600/600",
    tipo: "SEMILLA",
    genetica: "SATIVA",
    porcentaje_thc: null,
    unidad_medida: "UNIDADES",
    precio_venta_actual: 250,
    estado: "INACTIVO",
    stock: {
      cantidad_total: 8,
      cantidad_reservada: 0,
      cantidad_disponible: 8,
    },
  },
];

async function limpiarCatalogoProductos() {
  /*
  Se elimina primero Stock porque depende de Producto
  mediante una relación 1:1 con producto_id único.
  */
  await prisma.stock.deleteMany();

  /*
  Luego se eliminan los productos.
  Este seed se usa solamente en desarrollo
  y parte de una base sin compras, ventas,
  reservas ni movimientos asociados.
  */
  await prisma.producto.deleteMany();
}

async function crearProductos() {
  for (const product of products) {
    await prisma.producto.create({
      data: {
        nombre: product.nombre,
        descripcion: product.descripcion,
        imagen_url: product.imagen_url,
        tipo: product.tipo,
        genetica: product.genetica,
        porcentaje_thc: product.porcentaje_thc,
        unidad_medida: product.unidad_medida,
        precio_venta_actual: product.precio_venta_actual,
        estado: product.estado,
        stock: {
          create: product.stock,
        },
      },
    });
  }
}

async function main() {
  console.log("Iniciando seed destructivo de productos...");

  await limpiarCatalogoProductos();
  await crearProductos();

  console.log(`Seed finalizado. Productos creados: ${products.length}`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed de productos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });