// Importa los servicios encargados de la lógica de negocio de socios.
// El controller no accede directamente a la base de datos.
import {
  obtenerSocios,
  crearSocio,
  actualizarSocio,
  obtenerPerfilSocio,
  cambiarEstadoSocio,
  aceptarConsentimiento,
} from "../services/socioService.js";

// Importa el wrapper reutilizable para capturar errores async
// y derivarlos automáticamente al middleware global errorHandler.
import { asyncHandler } from "../utils/asyncHandler.js";

// Controller encargado de obtener la lista de socios registrados.
// Obtiene socios registrados permitiendo aplicar búsqueda opcional para gestión administrativa.
export const getSociosController = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const socios = await obtenerSocios(search);

  return res.status(200).json(socios);
});

// Controller encargado de registrar un nuevo socio en el sistema.
export const crearSocioController = asyncHandler(async (req, res) => {
  const datosSocio = req.body;

  const nuevoSocio = await crearSocio(datosSocio);

  return res.status(201).json({
    message: "Socio creado correctamente",
    socio: nuevoSocio,
  });
});

// Controller encargado de modificar los datos de un socio existente.
export const actualizarSocioController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const datosSocio = req.body;

  const socioActualizado = await actualizarSocio(Number(id), datosSocio);

  return res.status(200).json({
    message: "Socio actualizado correctamente",
    socio: socioActualizado,
  });
});

// Controller encargado de devolver el perfil del socio autenticado.
// El usuario_id se obtiene desde el token JWT cargado por verificarToken.
export const obtenerPerfilSocioController = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario.id;

  const perfil = await obtenerPerfilSocio(usuarioId);

  return res.status(200).json({
    message: "Perfil del socio obtenido correctamente",
    perfil,
  });
});

// Controller encargado de cambiar el estado de un socio.
// Centraliza activación, desactivación y suspensión.
export const cambiarEstadoSocioController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const socioActualizado = await cambiarEstadoSocio(Number(id), estado);

  return res.status(200).json({
    message: "Estado del socio actualizado correctamente",
    socio: socioActualizado,
  });
});

// Controller encargado de registrar la aceptación
// del consentimiento informado del socio autenticado.
export const aceptarConsentimientoSocio = asyncHandler(async (req, res) => {
  const usuarioId = req.usuario.id;

  const socioActualizado = await aceptarConsentimiento(usuarioId);

  return res.status(200).json({
    message: "Consentimiento aceptado correctamente",
    socio: socioActualizado,
  });
});
