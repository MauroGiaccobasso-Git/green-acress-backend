import { S3Client } from "@aws-sdk/client-s3";

import { AppError } from "../utils/appError.js";

const DEFAULT_MAX_SIZE_MB = 5;

const obtenerTamanioMaximoMb = () => {
  const valorConfigurado = Number(
    process.env.PRODUCT_IMAGE_MAX_SIZE_MB || DEFAULT_MAX_SIZE_MB,
  );

  if (!Number.isFinite(valorConfigurado) || valorConfigurado <= 0) {
    throw new Error(
      "PRODUCT_IMAGE_MAX_SIZE_MB debe ser un número mayor a cero.",
    );
  }

  return valorConfigurado;
};

export const PRODUCT_IMAGE_MAX_SIZE_BYTES =
  obtenerTamanioMaximoMb() * 1024 * 1024;

const obtenerVariableObligatoria = (nombreVariable) => {
  const valor = process.env[nombreVariable]?.trim();

  if (!valor || valor.startsWith("REPLACE_WITH_")) {
    throw new AppError(
      `La variable ${nombreVariable} no está configurada para S3.`,
      500,
      "S3_CONFIGURATION_ERROR",
    );
  }

  return valor;
};

export const obtenerConfiguracionS3 = () => ({
  region: obtenerVariableObligatoria("AWS_REGION"),
  bucket: obtenerVariableObligatoria("AWS_S3_BUCKET"),
  publicBaseUrl: obtenerVariableObligatoria(
    "AWS_S3_PUBLIC_BASE_URL",
  ).replace(/\/+$/, ""),
});

let s3Client = null;

export const obtenerS3Client = () => {
  if (!s3Client) {
    const { region } = obtenerConfiguracionS3();

    s3Client = new S3Client({
      region,
    });
  }

  return s3Client;
};