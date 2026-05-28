import { asyncHandler } from "../utils/asyncHandler.js";

import {
  obtenerProveedores,
  crearProveedor,
  actualizarProveedor,
  actualizarEstadoProveedor,
} from "../services/proveedorService.js";

export const getProveedoresController = asyncHandler(async (req, res) => {
  // Obtiene búsqueda opcional enviada por query params.
  const { search } = req.query;

  const proveedores = await obtenerProveedores(search);

  return res.status(200).json(proveedores);
});

export const crearProveedorController = asyncHandler(async (req, res) => {
  const proveedor = await crearProveedor(req.body);

  return res.status(201).json({
    message: "Proveedor creado correctamente",
    proveedor,
  });
});

export const actualizarProveedorController = asyncHandler(async (req, res) => {
  const proveedor = await actualizarProveedor(req.params.id, req.body);

  return res.status(200).json({
    message: "Proveedor actualizado correctamente",
    proveedor,
  });
});

export const actualizarEstadoProveedorController = asyncHandler(
  async (req, res) => {
    const proveedor = await actualizarEstadoProveedor(
      req.params.id,
      req.body.estado,
    );

    return res.status(200).json({
      message: "Estado del proveedor actualizado correctamente",
      proveedor,
    });
  },
);
