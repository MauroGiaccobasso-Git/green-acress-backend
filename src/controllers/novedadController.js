import { asyncHandler } from "../utils/asyncHandler.js";
import {
  obtenerNovedades,
  obtenerNovedadPorId,
  crearNovedad,
  cambiarEstadoNovedad,
} from "../services/novedadService.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta todas las novedades administrativas.
export const getNovedadesController = asyncHandler(
  async (req, res) => {
    const novedades = await obtenerNovedades();

    return res.status(200).json({
      message: "Novedades obtenidas correctamente",
      novedades,
    });
  },
);


// Consulta el detalle administrativo de una novedad.
export const getNovedadPorIdController = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    const novedad =
      await obtenerNovedadPorId(id);

    return res.status(200).json({
      message: "Novedad obtenida correctamente",
      novedad,
    });
  },
);


/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Crea una nueva comunicación administrativa.
export const crearNovedadController = asyncHandler(
  async (req, res) => {

    const usuarioId = req.usuario.id;


    const nuevaNovedad =
      await crearNovedad({
        usuarioId,
        ...req.body,
      });


    return res.status(201).json({
      message: "Novedad creada correctamente",
      novedad: nuevaNovedad,
    });
  },
);


// Cambia el estado administrativo de una novedad.
export const cambiarEstadoNovedadController =
  asyncHandler(async (req, res) => {

    const usuarioId = req.usuario.id;

    const { estado } = req.body;


    const novedadActualizada =
      await cambiarEstadoNovedad({
        novedadId: req.params.id,
        estado,
        usuarioId,
      });


    return res.status(200).json({
      message:
        "Estado de la novedad actualizado correctamente",
      novedad: novedadActualizada,
    });
  });