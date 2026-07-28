import {
  configurarMfaUsuario,
  confirmarMfaUsuario,
} from "../services/mfaService.js";

import { asyncHandler } from "../utils/asyncHandler.js";


/* =========================================================
   CONFIGURAR MFA
========================================================= */

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