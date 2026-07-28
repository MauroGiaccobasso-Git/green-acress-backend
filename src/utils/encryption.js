import crypto from "crypto";
import { AppError } from "./appError.js";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const ALGORITHM = "aes-256-gcm";

const obtenerClaveCifrado = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new AppError(
      "La clave de cifrado no está configurada",
      500,
      "ENCRYPTION_KEY_NOT_CONFIGURED",
    );
  }

  /*
    AES-256 requiere exactamente 32 bytes.

    En producción la clave debe generarse
    como secreto seguro.
  */
  return crypto
    .createHash("sha256")
    .update(key)
    .digest();
};

/* =========================================================
   CIFRADO
========================================================= */

/**
 * Cifra información sensible antes de almacenarla.
 *
 * Uso principal:
 * - secretos MFA
 */
export const cifrar = (textoPlano) => {
  if (!textoPlano) {
    throw new AppError(
      "No se puede cifrar un valor vacío",
      400,
      "ENCRYPTION_EMPTY_VALUE",
    );
  }

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    obtenerClaveCifrado(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  /*
    Guardamos todo junto:

    iv + authTag + contenido cifrado

    convertido a hexadecimal.
  */
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

/* =========================================================
   DESCIFRADO
========================================================= */

/**
 * Recupera el valor original desde BD.
 */
export const descifrar = (valorCifrado) => {
  if (!valorCifrado) {
    throw new AppError(
      "No existe un valor cifrado para descifrar",
      400,
      "ENCRYPTION_EMPTY_VALUE",
    );
  }

  try {
    const [
      ivHex,
      authTagHex,
      encryptedHex,
    ] = valorCifrado.split(":");

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      obtenerClaveCifrado(),
      Buffer.from(ivHex, "hex"),
    );

    decipher.setAuthTag(
      Buffer.from(authTagHex, "hex"),
    );

    const decrypted = Buffer.concat([
      decipher.update(
        Buffer.from(encryptedHex, "hex"),
      ),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");

  } catch (error) {
    throw new AppError(
      "No se pudo descifrar la información",
      500,
      "ENCRYPTION_DECRYPT_FAILED",
    );
  }
};