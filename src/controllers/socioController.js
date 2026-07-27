import {
  aceptarConsentimiento,
  actualizarSocio,
  cambiarEstadoSocio,
  crearSocio,
  getSocioPorId,
  getSocios,
  getSociosOpcionesVenta,
  obtenerPerfilSocio,
} from "../services/socioService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* =========================================================
   CONSULTAS ADMINISTRATIVAS
========================================================= */

// Consulta socios con búsqueda, filtros y paginación.
export const getSociosController = asyncHandler(async (req, res) => {
  const { search, estado, estadoUsuario, page, limit } = req.query;

  const resultado = await getSocios({
    search,
    estado,
    estadoUsuario,
    page,
    limit,
  });

  return res.status(200).json({
    message: "Socios obtenidos correctamente",
    socios: resultado.data,
    pagination: resultado.pagination,
  });
});

// Consulta las opciones mínimas de socios habilitados para registrar ventas.
export const getSociosOpcionesVentaController = asyncHandler(
  async (req, res) => {
    const socios = await getSociosOpcionesVenta();

    return res.status(200).json({
      message: "Opciones de socios para ventas obtenidas correctamente",
      socios,
    });
  },
);

// Consulta el detalle administrativo de un socio.
export const getSocioPorIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const socio = await getSocioPorId(id);

  return res.status(200).json({
    message: "Socio obtenido correctamente",
    socio,
  });
});

/* =========================================================
   OPERACIONES ADMINISTRATIVAS
========================================================= */

// Registra un nuevo socio y su usuario asociado.
export const crearSocioController = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario.id;

  const nuevoSocio = await crearSocio({
    usuarioId,
    ...req.body,
  });

  return res.status(201).json({
    message: "Socio creado correctamente",
    socio: nuevoSocio,
  });
});

// Actualiza los datos personales y de acceso de un socio.
export const actualizarSocioController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  const socioActualizado = await actualizarSocio({
    socioId: id,
    usuarioId,
    datosSocio: req.body,
  });

  return res.status(200).json({
    message: "Socio actualizado correctamente",
    socio: socioActualizado,
  });
});

// Cambia el estado funcional del socio y sincroniza su acceso.
export const cambiarEstadoSocioController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado, motivo } = req.body;
  const usuarioId = req.usuario.id;

  const socioActualizado = await cambiarEstadoSocio({
    socioId: id,
    usuarioId,
    nuevoEstado: estado,
    motivo,
  });

  return res.status(200).json({
    message: "Estado del socio actualizado correctamente",
    socio: socioActualizado,
  });
});

/* =========================================================
   PERFIL Y CONSENTIMIENTO
========================================================= */

// Consulta el perfil del socio autenticado.
export const obtenerPerfilSocioController = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario.id;

  const perfil = await obtenerPerfilSocio(usuarioId);

  return res.status(200).json({
    message: "Perfil del socio obtenido correctamente",
    perfil,
  });
});

// Registra la aceptación del consentimiento informado.
export const aceptarConsentimientoSocio = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario.id;

  const socioActualizado = await aceptarConsentimiento(usuarioId);

  return res.status(200).json({
    message: "Consentimiento aceptado correctamente",
    socio: socioActualizado,
  });
});