import multer from "multer";

import { PRODUCT_IMAGE_MAX_SIZE_BYTES } from "../config/s3.js";
import { AppError } from "../utils/appError.js";

const TIPOS_IMAGEN_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// Mantiene temporalmente la imagen en memoria.
// Luego será enviada a Amazon S3.
const almacenamientoEnMemoria = multer.memoryStorage();

// Permite únicamente formatos seguros para imágenes de productos.
const validarTipoImagen = (req, archivo, callback) => {
  if (!TIPOS_IMAGEN_PERMITIDOS.has(archivo.mimetype)) {
    return callback(
      new AppError(
        "La imagen debe tener formato JPG, PNG o WEBP.",
        400,
        "INVALID_PRODUCT_IMAGE_TYPE",
      ),
    );
  }

  return callback(null, true);
};

const cargaImagenProducto = multer({
  storage: almacenamientoEnMemoria,
  limits: {
    fileSize: PRODUCT_IMAGE_MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter: validarTipoImagen,
}).single("imagen");

// Recibe una única imagen enviada en el campo llamado "imagen".
export const recibirImagenProducto = (req, res, next) => {
  cargaImagenProducto(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        const tamanioMaximoMb =
          PRODUCT_IMAGE_MAX_SIZE_BYTES / 1024 / 1024;

        return next(
          new AppError(
            `La imagen no puede superar los ${tamanioMaximoMb} MB.`,
            400,
            "PRODUCT_IMAGE_TOO_LARGE",
          ),
        );
      }

      return next(
        new AppError(
          "No se pudo procesar la imagen enviada.",
          400,
          "INVALID_PRODUCT_IMAGE",
        ),
      );
    }

    return next(error);
  });
};