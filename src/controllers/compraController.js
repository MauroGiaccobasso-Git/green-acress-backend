import { asyncHandler } from "../utils/asyncHandler.js";
import { registrarCompra } from "../services/compraService.js";

/**
 * Registra una nueva compra.
 *
 * El usuario autenticado se obtiene desde el token JWT validado
 * por los middlewares de autenticación.
 */
export const registrarCompraController = asyncHandler(async (req, res) => {
  const compra = await registrarCompra(req.body, req.usuario.id);

  res.status(201).json({
    mensaje: "Compra registrada correctamente",
    datos: compra,
  });
});