import { asyncHandler } from "../utils/asyncHandler.js";
import {
  cambiarEstadoNovedad,
  crearNovedad,
  obtenerNovedadPorId,
  obtenerNovedades,
  obtenerNovedadesActivas,
} from "../services/novedadService.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta novedades aplicando búsqueda y filtro por estado.
export const getNovedadesController = asyncHandler(
  async (req, res) => {
    const { search = "", estado } = req.query;

    const novedades = await obtenerNovedades({
      search,
      estado,
    });

    return res.status(200).json({
      message: "Novedades obtenidas correctamente",
      novedades,
    });
  },
);

// Consulta el detalle administrativo de una novedad.
export const getNovedadPorIdController = asyncHandler(
  async (req, res) => {
    const novedad = await obtenerNovedadPorId(
      req.params.id,
    );

    return res.status(200).json({
      message: "Novedad obtenida correctamente",
      novedad,
    });
  },
);

/* =========================================================
   CONSULTAS DEL SOCIO
========================================================= */

// Consulta únicamente novedades activas para el portal.
export const getNovedadesActivasController = asyncHandler(
  async (_req, res) => {
    const novedades =
      await obtenerNovedadesActivas();

    return res.status(200).json({
      message:
        "Novedades activas obtenidas correctamente",
      novedades,
    });
  },
);

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Crea y publica inmediatamente una novedad activa.
export const crearNovedadController = asyncHandler(
  async (req, res) => {
    const novedad = await crearNovedad({
      datosNovedad: req.body,
      usuarioId: req.usuario.id,
    });

    return res.status(201).json({
      message:
        "Novedad publicada correctamente",
      novedad,
    });
  },
);

// Cambia exclusivamente el estado lógico de una novedad.
export const cambiarEstadoNovedadController =
  asyncHandler(async (req, res) => {
    const novedad =
      await cambiarEstadoNovedad({
        novedadId: req.params.id,
        datosEstado: req.body,
        usuarioId: req.usuario.id,
      });

    return res.status(200).json({
      message:
        "Estado de la novedad actualizado correctamente",
      novedad,
    });
  });