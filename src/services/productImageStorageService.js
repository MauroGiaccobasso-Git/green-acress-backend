import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import {
  obtenerConfiguracionS3,
  obtenerS3Client,
} from "../config/s3.js";
import { AppError } from "../utils/appError.js";

/* =========================================================
   CONFIGURACIÓN DE FORMATOS
========================================================= */

const EXTENSIONES_POR_TIPO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PREFIJO_IMAGENES_PRODUCTOS = "productos/";

/* =========================================================
   VALIDACIÓN DEL CONTENIDO
========================================================= */

// Comprueba la firma binaria real de una imagen JPEG.
const esImagenJpeg = (buffer) =>
  buffer.length >= 3 &&
  buffer[0] === 0xff &&
  buffer[1] === 0xd8 &&
  buffer[2] === 0xff;

// Comprueba la firma binaria real de una imagen PNG.
const esImagenPng = (buffer) =>
  buffer.length >= 8 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

// Comprueba la firma binaria real de una imagen WEBP.
const esImagenWebp = (buffer) =>
  buffer.length >= 12 &&
  buffer.toString("ascii", 0, 4) === "RIFF" &&
  buffer.toString("ascii", 8, 12) === "WEBP";

const VALIDADORES_CONTENIDO_POR_TIPO = {
  "image/jpeg": esImagenJpeg,
  "image/png": esImagenPng,
  "image/webp": esImagenWebp,
};

// Evita confiar únicamente en el MIME enviado por el navegador.
// El archivo debe coincidir realmente con JPG, PNG o WEBP.
const validarContenidoImagen = (archivo) => {
  const validarContenido = VALIDADORES_CONTENIDO_POR_TIPO[archivo.mimetype];

  if (!validarContenido || !validarContenido(archivo.buffer)) {
    throw new AppError(
      "El contenido del archivo no corresponde a una imagen válida.",
      400,
      "INVALID_PRODUCT_IMAGE_CONTENT",
    );
  }
};

/* =========================================================
   HELPERS DE CLAVES Y URLS
========================================================= */

// Genera una clave única para evitar colisiones entre imágenes.
const crearNombreImagen = (tipoImagen) => {
  const extension = EXTENSIONES_POR_TIPO[tipoImagen];

  if (!extension) {
    throw new AppError(
      "El formato de la imagen no está permitido.",
      400,
      "INVALID_PRODUCT_IMAGE_TYPE",
    );
  }

  return `${PREFIJO_IMAGENES_PRODUCTOS}${randomUUID()}.${extension}`;
};

// Verifica que la clave pertenezca al directorio administrado
// específicamente por las imágenes de productos.
const esImagenProductoAdministrada = (imagenKey) =>
  typeof imagenKey === "string" &&
  imagenKey.startsWith(PREFIJO_IMAGENES_PRODUCTOS) &&
  !imagenKey.includes("..");

// Obtiene la clave interna únicamente cuando la URL pertenece
// al almacenamiento S3 configurado para Green Acres.
const obtenerImagenKeyDesdeUrl = (imagenUrl) => {
  if (!imagenUrl || typeof imagenUrl !== "string") {
    return null;
  }

  const { publicBaseUrl } = obtenerConfiguracionS3();

  try {
    const urlImagen = new URL(imagenUrl);
    const urlBase = new URL(publicBaseUrl);

    if (urlImagen.origin !== urlBase.origin) {
      return null;
    }

    const rutaBase = urlBase.pathname.replace(/\/+$/, "");
    const prefijoRuta = `${rutaBase}/`;

    if (!urlImagen.pathname.startsWith(prefijoRuta)) {
      return null;
    }

    const imagenKey = decodeURIComponent(
      urlImagen.pathname.slice(prefijoRuta.length),
    );

    return esImagenProductoAdministrada(imagenKey) ? imagenKey : null;
  } catch {
    return null;
  }
};

/* =========================================================
   OPERACIONES DE ALMACENAMIENTO
========================================================= */

// Sube la imagen de un producto a Amazon S3
// y devuelve tanto su clave interna como su URL pública.
export const subirImagenProducto = async (archivo) => {
  if (!archivo?.buffer) {
    throw new AppError(
      "No se recibió una imagen para el producto.",
      400,
      "PRODUCT_IMAGE_REQUIRED",
    );
  }

  validarContenidoImagen(archivo);

  const { bucket, publicBaseUrl } = obtenerConfiguracionS3();
  const s3Client = obtenerS3Client();
  const imagenKey = crearNombreImagen(archivo.mimetype);

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: imagenKey,
        Body: archivo.buffer,
        ContentType: archivo.mimetype,
        ContentLength: archivo.size,
        ContentDisposition: "inline",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    console.error("Error al subir la imagen del producto a S3:", error);

    throw new AppError(
      "No se pudo guardar la imagen del producto.",
      502,
      "PRODUCT_IMAGE_UPLOAD_ERROR",
    );
  }

  return {
    key: imagenKey,
    url: `${publicBaseUrl}/${imagenKey}`,
  };
};

// Elimina una imagen administrada por Green Acres.
//
// Se utiliza tanto para compensar operaciones fallidas como
// para limpiar una imagen anterior después de reemplazarla.
export const eliminarImagenProducto = async (imagenKey) => {
  if (!esImagenProductoAdministrada(imagenKey)) {
    return false;
  }

  const { bucket } = obtenerConfiguracionS3();
  const s3Client = obtenerS3Client();

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: imagenKey,
      }),
    );

    return true;
  } catch (error) {
    console.error("No se pudo eliminar la imagen del producto de S3:", error);

    return false;
  }
};

// Elimina una imagen administrada por Green Acres a partir de su URL.
// Las URLs externas o históricas se ignoran de manera segura.
export const eliminarImagenProductoPorUrl = async (imagenUrl) => {
  const imagenKey = obtenerImagenKeyDesdeUrl(imagenUrl);

  if (!imagenKey) {
    return false;
  }

  return eliminarImagenProducto(imagenKey);
};