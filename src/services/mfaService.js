import prisma from "../config/prisma.js";
import { generateSecret, verify } from "otplib";
import bcrypt from "bcrypt";

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
  const resultado = await verify({
    secret: secreto,
    token: codigo,
  });

  return resultado.valid;
};


/* =========================================================
   VALIDACIÓN CÓDIGO DE RECUPERACIÓN MFA
========================================================= */

/**
 * Valida un código de recuperación MFA.
 *
 * Los códigos de recuperación funcionan como llaves
 * de emergencia de un solo uso cuando el administrador
 * no dispone del código TOTP generado por su aplicación
 * autenticadora.
 *
 * Flujo:
 *
 * ADMIN ingresa código recuperación
 *          ↓
 * Backend obtiene hashes disponibles
 *          ↓
 * Compara mediante bcrypt
 *          ↓
 * Código válido
 *          ↓
 * Marca código como utilizado
 */
export const validarCodigoRecuperacionMfa = async (
  usuarioId,
  codigo,
) => {

  if (!codigo || typeof codigo !== "string") {
    return false;
  }


  const codigosDisponibles =
    await prisma.codigoRecuperacionMfa.findMany({
      where: {
        usuario_id: usuarioId,
        usado_en: null,
      },
    });


  for (const codigoRecuperacion of codigosDisponibles) {

    const codigoValido =
      await bcrypt.compare(
        codigo,
        codigoRecuperacion.codigo_hash,
      );


    if (codigoValido) {

      await prisma.codigoRecuperacionMfa.update({
        where: {
          id: codigoRecuperacion.id,
        },
        data: {
          usado_en: new Date(),
        },
      });


      return true;
    }
  }


  return false;
};


/* =========================================================
   CÓDIGOS DE RECUPERACIÓN MFA
========================================================= */

export const generarCodigosRecuperacionMfa = async () => {
  const codigos = [];

  for (let i = 0; i < CANTIDAD_CODIGOS_RECUPERACION; i++) {

    const codigo =
      `${generarBloqueCodigo()}-${generarBloqueCodigo()}`;


    const hash =
      await bcrypt.hash(
        codigo,
        10,
      );


    codigos.push({
      codigo,
      hash,
    });
  }

  return codigos;
};


/* =========================================================
   CONFIGURACIÓN MFA USUARIO
========================================================= */

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
      },
    });


    if (!usuario) {
      throw new AppError(
        "Usuario no encontrado",
        404,
        "USER_NOT_FOUND",
      );
    }


    if (usuario.rol !== "ADMIN") {
      throw new AppError(
        "Solo los administradores pueden configurar MFA",
        403,
        "MFA_ADMIN_ONLY",
      );
    }


    const secreto =
      generarSecretoMfa();


    const secretoCifrado =
      cifrar(secreto);


    await tx.codigoRecuperacionMfa.deleteMany({
      where: {
        usuario_id: usuario.id,
      },
    });


    const codigos =
      await generarCodigosRecuperacionMfa();


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
        detalle:
          "Se inició la configuración MFA del administrador.",
      },
      tx,
    );


    return {
      secreto,
      codigosRecuperacion:
        codigos.map((codigo) => codigo.codigo),
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
export const confirmarMfaUsuario = async (
  usuarioId,
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
        mfa_secreto_cifrado: true,
        mfa_habilitado: true,
      },
    });


    if (!usuario) {
      throw new AppError(
        "Usuario no encontrado",
        404,
        "USER_NOT_FOUND",
      );
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


    const secreto =
      descifrar(usuario.mfa_secreto_cifrado);


    const codigoValido =
      await validarCodigoMfa(
        secreto,
        codigo,
      );


    if (!codigoValido) {
      throw new AppError(
        "El código MFA es incorrecto",
        401,
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
        detalle:
          "El administrador confirmó y activó MFA correctamente.",
      },
      tx,
    );


    return {
      message: "MFA activado correctamente",
    };
  });
};


/* =========================================================
   HELPERS PRIVADOS
========================================================= */

const generarBloqueCodigo = () => {

  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


  let resultado = "";


  for (
    let i = 0;
    i < LONGITUD_BLOQUE_CODIGO;
    i++
  ) {

    const posicion =
      Math.floor(
        Math.random() * caracteres.length,
      );


    resultado += caracteres[posicion];
  }


  return resultado;
};