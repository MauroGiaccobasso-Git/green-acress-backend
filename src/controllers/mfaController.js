import {
  configurarMfaUsuario,
  confirmarMfaUsuario,
  desactivarMfaUsuario,
} from "../services/mfaService.js";

import { asyncHandler } from "../utils/asyncHandler.js";


/* =========================================================
   CONFIGURAR MFA
========================================================= */

/**
 * Inicia la configuración MFA para un administrador.
 *
 * Genera:
 * - secreto temporal cifrado;
 * - códigos de recuperación;
 *
 * MFA permanece deshabilitado hasta confirmar
 * correctamente el código TOTP.
 */
export const configurarMfa = asyncHandler(
  async (req, res) => {

    const resultado =
      await configurarMfaUsuario(
        req.usuario.id,
      );


    return res.status(200).json({
      message:
        "Configuración MFA iniciada correctamente",
      ...resultado,
    });
  },
);


/* =========================================================
   CONFIRMAR MFA
========================================================= */

/**
 * Confirma la activación MFA mediante
 * un código generado por la aplicación autenticadora.
 */
export const confirmarMfa = asyncHandler(
  async (req, res) => {

    const {
      codigo,
    } = req.body;


    const resultado =
      await confirmarMfaUsuario(
        req.usuario.id,
        codigo,
      );


    return res.status(200).json(resultado);
  },
);


/* =========================================================
   DESACTIVAR MFA
========================================================= */

/**
 * Desactiva MFA para un administrador autenticado.
 *
 * Requiere:
 * - contraseña actual;
 * - código TOTP válido.
 *
 * El service se encarga de:
 * - validar identidad;
 * - eliminar configuración sensible;
 * - invalidar recuperación MFA;
 * - registrar auditoría.
 */
export const desactivarMfa = asyncHandler(
  async (req, res) => {

    const {
      passwordActual,
      codigo,
    } = req.body;


    const resultado =
      await desactivarMfaUsuario(
        req.usuario.id,
        passwordActual,
        codigo,
      );


    return res.status(200).json(resultado);
  },
);