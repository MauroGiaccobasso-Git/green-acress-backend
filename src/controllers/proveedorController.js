import {
  actualizarEstadoProveedor,
  actualizarProveedor,
  crearProveedor,
  obtenerProveedores,
} from "../services/proveedorService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta proveedores aplicando búsqueda y filtro por estado.
export const getProveedoresController = asyncHandler(async (req, res) => {
  const { search = "", estado } = req.query;

  const proveedores = await obtenerProveedores({
    search,
    estado,
  });

  // Se mantiene el contrato actual para no afectar el módulo de Compras.
  return res.status(200).json(proveedores);
});

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra un proveedor y audita al administrador responsable.
export const crearProveedorController = asyncHandler(async (req, res) => {
  const proveedor = await crearProveedor({
    datosProveedor: req.body,
    usuarioId: req.usuario.id,
  });

  return res.status(201).json({
    message: "Proveedor creado correctamente",
    proveedor,
  });
});

// Actualiza los datos de un proveedor existente.
export const actualizarProveedorController = asyncHandler(async (req, res) => {
  const proveedor = await actualizarProveedor({
    proveedorId: req.params.id,
    datosProveedor: req.body,
    usuarioId: req.usuario.id,
  });

  return res.status(200).json({
    message: "Proveedor actualizado correctamente",
    proveedor,
  });
});

// Cambia el estado lógico de un proveedor.
export const actualizarEstadoProveedorController = asyncHandler(
  async (req, res) => {
    const proveedor = await actualizarEstadoProveedor({
      proveedorId: req.params.id,
      nuevoEstado: req.body.estado,
      usuarioId: req.usuario.id,
    });

    return res.status(200).json({
      message: "Estado del proveedor actualizado correctamente",
      proveedor,
    });
  },
);