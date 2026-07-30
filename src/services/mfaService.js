import prisma from "../config/prisma.js";
import { generateSecret, verify } from "otplib";
import bcrypt from "bcrypt";
import { randomInt } from "node:crypto";

import { AppError } from "../utils/appError.js";
import { cifrar, descifrar } from "../utils/encryption.js";
import { registrarAuditoria } from "./auditoriaService.js";

/* =========================================================
   CONSTANTES
========================================================= */

const CANTIDAD_CODIGOS_RECUPERACION = 8;
const LONGITUD_BLOQUE_CODIGO = 4;

/* =========================================================
   GENERACIÓN DE SECRETO MFA
========================================================= */

export const generarSecretoMfa = () => {
  return generateSecret();
};

/* =========================================================
   VALIDACIÓN TOTP
========================================================= */

export const validarCodigoMfa = async (secreto, codigo) => {
  if (typeof codigo !== "string" || !codigo.trim()) {
    return false;
  }

  const resultado = await verify({
    secret: secreto,
    token: codigo.trim(),
  });

  return resultado.valid;
};

/* =========================================================
   VALIDACIÓN CÓDIGO DE RECUPERACIÓN MFA
========================================================= */

/**
 * Valida y consume de forma segura un código de recuperación MFA.
 *
 * Los códigos de recuperación funcionan como llaves
 * de emergencia de un solo uso cuando el administrador
 * no dispone del código TOTP generado por su aplicación
 * autenticadora.
 *
 * Flujo:
 *
 * ADMIN ingresa código de recuperación
 *          ↓
 * Backend obtiene hashes disponibles
 *          ↓
 * Compara mediante bcrypt
 *          ↓
 * Código válido
 *          ↓
 * Intenta marcarlo como utilizado
 *          ↓
 * Solo una solicitud puede consumirlo
 */
export const validarCodigoRecuperacionMfa = async (usuarioId, codigo) => {
  if (!codigo || typeof codigo !== "string") {
    return false;
  }

  const codigoNormalizado = codigo.trim().toUpperCase();

  const codigosDisponibles = await prisma.codigoRecuperacionMfa.findMany({
    where: {
      usuario_id: usuarioId,
      usado_en: null,
    },
  });

  for (const codigoRecuperacion of codigosDisponibles) {
    const codigoValido = await bcrypt.compare(
      codigoNormalizado,
      codigoRecuperacion.codigo_hash,
    );

    if (!codigoValido) {
      continue;
    }

    const codigoConsumido = await prisma.codigoRecuperacionMfa.updateMany({
      where: {
        id: codigoRecuperacion.id,
        usado_en: null,
      },
      data: {
        usado_en: new Date(),
      },
    });

    return codigoConsumido.count === 1;
  }

  return false;
};

/* =========================================================
   CÓDIGOS DE RECUPERACIÓN MFA
========================================================= */

/**
 * Genera los códigos de recuperación MFA.
 *
 * Los códigos:
 * - son únicos dentro del mismo lote;
 * - se muestran una sola vez al administrador;
 * - se guardan posteriormente como hash;
 * - pueden utilizarse una única vez.
 */
export const generarCodigosRecuperacionMfa = async () => {
  const codigosUnicos = new Set();

  while (codigosUnicos.size < CANTIDAD_CODIGOS_RECUPERACION) {
    const codigo = `${generarBloqueCodigo()}-${generarBloqueCodigo()}`;

    codigosUnicos.add(codigo);
  }

  return Promise.all(
    Array.from(codigosUnicos).map(async (codigo) => ({
      codigo,
      hash: await bcrypt.hash(codigo, 10),
    })),
  );
};

/* =========================================================
   CONFIGURACIÓN MFA USUARIO
========================================================= */

/**
 * Inicia la configuración MFA para un administrador.
 *
 * Este proceso:
 * - solo puede ser ejecutado por un ADMIN activo;
 * - no permite sobrescribir una configuración MFA ya habilitada;
 * - genera un nuevo secreto MFA;
 * - reemplaza cualquier configuración pendiente anterior;
 * - genera nuevos códigos de recuperación;
 * - mantiene MFA deshabilitado hasta confirmar el código TOTP.
 */
export const configurarMfaUsuario = async (usuarioId) => {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        email: true,
        rol: true,
        estado: true,
        mfa_habilitado: true,
      },
    });

    if (!usuario) {
      throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
    }

    if (usuario.rol !== "ADMIN") {
      throw new AppError(
        "Solo los administradores pueden configurar MFA",
        403,
        "MFA_ADMIN_ONLY",
      );
    }

    if (usuario.estado !== "ACTIVO") {
      throw new AppError(
        "El usuario no se encuentra habilitado",
        403,
        "USER_NOT_ACTIVE",
      );
    }

    if (usuario.mfa_habilitado) {
      throw new AppError(
        "El MFA ya se encuentra habilitado",
        409,
        "MFA_ALREADY_ENABLED",
      );
    }

    const secreto = generarSecretoMfa();
    const secretoCifrado = cifrar(secreto);

    const codigos = await generarCodigosRecuperacionMfa();

    await tx.codigoRecuperacionMfa.deleteMany({
      where: {
        usuario_id: usuario.id,
      },
    });

    await tx.codigoRecuperacionMfa.createMany({
      data: codigos.map((codigo) => ({
        usuario_id: usuario.id,
        codigo_hash: codigo.hash,
      })),
    });

    await tx.usuario.update({
      where: {
        id: usuario.id,
      },
      data: {
        mfa_secreto_cifrado: secretoCifrado,
        fecha_configuracion_mfa: new Date(),
        mfa_habilitado: false,
      },
    });

    await registrarAuditoria(
      {
        usuarioId: usuario.id,
        accion: "CONFIGURAR_MFA",
        entidad: "Usuario",
        entidadId: usuario.id,
        detalle: "Se inició la configuración MFA del administrador.",
      },
      tx,
    );

    return {
      secreto,
      codigosRecuperacion: codigos.map((codigo) => codigo.codigo),
    };
  });
};
/* =========================================================
   CONFIRMAR MFA
========================================================= */

/**
 * Confirma la activación de MFA.
 *
 * Flujo:
 *
 * ADMIN configura MFA
 *        ↓
 * Guarda secreto cifrado
 *        ↓
 * ADMIN ingresa código TOTP
 *        ↓
 * Backend descifra secreto
 *        ↓
 * Valida código
 *        ↓
 * Activa MFA
 */
export const confirmarMfaUsuario = async (usuarioId, codigo) => {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        rol: true,
        mfa_secreto_cifrado: true,
        mfa_habilitado: true,
      },
    });

    if (!usuario) {
      throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
    }

    if (usuario.rol !== "ADMIN") {
      throw new AppError(
        "Solo los administradores pueden utilizar MFA",
        403,
        "MFA_ADMIN_ONLY",
      );
    }

    if (!usuario.mfa_secreto_cifrado) {
      throw new AppError(
        "El usuario no tiene una configuración MFA iniciada",
        400,
        "MFA_NOT_CONFIGURED",
      );
    }

    if (usuario.mfa_habilitado) {
      throw new AppError(
        "El MFA ya se encuentra habilitado",
        400,
        "MFA_ALREADY_ENABLED",
      );
    }

    const secreto = descifrar(usuario.mfa_secreto_cifrado);

    const codigoValido = await validarCodigoMfa(secreto, codigo);

    if (!codigoValido) {
      throw new AppError(
        "El código MFA es incorrecto",
        400,
        "MFA_INVALID_CODE",
      );
    }

    await tx.usuario.update({
      where: {
        id: usuario.id,
      },
      data: {
        mfa_habilitado: true,
      },
    });

    await registrarAuditoria(
      {
        usuarioId: usuario.id,
        accion: "ACTIVAR_MFA",
        entidad: "Usuario",
        entidadId: usuario.id,
        detalle: "El administrador confirmó y activó MFA correctamente.",
      },
      tx,
    );

    return {
      message: "MFA activado correctamente",
    };
  });
};

/* =========================================================
   DESACTIVAR MFA
========================================================= */

/**
 * Desactiva MFA para un administrador.
 *
 * Requiere confirmación adicional mediante:
 * - contraseña actual;
 * - código TOTP vigente.
 *
 * Flujo:
 *
 * ADMIN autenticado
 *        ↓
 * Ingresa contraseña actual
 *        ↓
 * Ingresa código TOTP
 *        ↓
 * Backend valida identidad
 *        ↓
 * Elimina configuración MFA
 *        ↓
 * Invalida sesiones existentes
 *        ↓
 * Registra auditoría
 */
export const desactivarMfaUsuario = async (
  usuarioId,
  passwordActual,
  codigo,
) => {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        rol: true,
        estado: true,
        password_hash: true,
        mfa_habilitado: true,
        mfa_secreto_cifrado: true,
      },
    });

    if (!usuario) {
      throw new AppError("Usuario no encontrado", 404, "USER_NOT_FOUND");
    }

    if (usuario.rol !== "ADMIN") {
      throw new AppError(
        "Solo los administradores pueden gestionar MFA",
        403,
        "MFA_ADMIN_ONLY",
      );
    }

    if (usuario.estado !== "ACTIVO") {
      throw new AppError(
        "El usuario no se encuentra habilitado",
        403,
        "USER_NOT_ACTIVE",
      );
    }

    if (!usuario.mfa_habilitado) {
      throw new AppError(
        "El MFA no se encuentra habilitado",
        400,
        "MFA_NOT_ENABLED",
      );
    }

    const passwordValida = await bcrypt.compare(
      passwordActual,
      usuario.password_hash,
    );

    if (!passwordValida) {
      throw new AppError(
        "La contraseña actual es incorrecta",
        400,
        "INVALID_CURRENT_PASSWORD",
      );
    }

    if (!usuario.mfa_secreto_cifrado) {
      throw new AppError(
        "No existe una configuración MFA válida",
        400,
        "MFA_NOT_CONFIGURED",
      );
    }

    const secreto = descifrar(usuario.mfa_secreto_cifrado);

    const codigoValido = await validarCodigoMfa(secreto, codigo);

    if (!codigoValido) {
      throw new AppError(
        "El código MFA es incorrecto",
        400,
        "MFA_INVALID_CODE",
      );
    }

    await tx.codigoRecuperacionMfa.deleteMany({
      where: {
        usuario_id: usuario.id,
      },
    });

    await tx.usuario.update({
      where: {
        id: usuario.id,
      },
      data: {
        mfa_habilitado: false,
        mfa_secreto_cifrado: null,
        fecha_configuracion_mfa: null,
        version_sesion: {
          increment: 1,
        },
      },
    });

    await registrarAuditoria(
      {
        usuarioId: usuario.id,
        accion: "DESACTIVAR_MFA",
        entidad: "Usuario",
        entidadId: usuario.id,
        detalle:
          "El administrador desactivó MFA y se eliminaron las configuraciones asociadas.",
      },
      tx,
    );

    return {
      message: "MFA desactivado correctamente",
    };
  });
};

/* =========================================================
   HELPERS PRIVADOS
========================================================= */

/**
 * Genera un bloque aleatorio para un código de recuperación.
 *
 * Cada carácter se obtiene mediante un generador
 * criptográficamente seguro.
 *
 * Ejemplos:
 *
 * A7KD
 * X91P
 * M4QZ
 */
const generarBloqueCodigo = () => {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  return Array.from(
    { length: LONGITUD_BLOQUE_CODIGO },
    () => caracteres[randomInt(caracteres.length)],
  ).join("");
};
