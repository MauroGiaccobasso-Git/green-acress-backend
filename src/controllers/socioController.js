// Importa el servicio encargado de consultar los socios
// El controlador delega la lógica de acceso a datos al service
import {
  obtenerSocios,
  crearSocio,
  actualizarSocio,
  obtenerPerfilSocio,
  cambiarEstadoSocio,
  aceptarConsentimiento,
} from "../services/socioService.js";

// Controlador encargado de manejar la request HTTP
// para obtener la lista de socios registrados
export const getSociosController = async (req, res) => {
  try {
    // Ejecuta el servicio que consulta los socios en la base de datos
    const socios = await obtenerSocios();

    // Responde con estado 200 y la lista de socios obtenida
    res.status(200).json(socios);
  } catch (error) {
    // Muestra el error en consola para debugging
    console.error(error);

    // Respuesta genérica de error interno del servidor
    res.status(500).json({
      error: "Error al obtener los socios",
    });
  }
};

// Controlador encargado de manejar la request HTTP
// para registrar un nuevo socio en el sistema
export const crearSocioController = async (req, res) => {
  try {
    // Obtiene los datos enviados en el body de la request
    const datosSocio = req.body;

    // Ejecuta el servicio encargado de crear el socio en la base de datos
    const nuevoSocio = await crearSocio(datosSocio);

    // Responde con estado 201 indicando que el recurso fue creado correctamente
    res.status(201).json({
      message: "Socio creado correctamente",
      socio: nuevoSocio,
    });
  } catch (error) {
    // Muestra el error en consola para facilitar debugging
    console.error(error);

    // Responde con error 400 porque puede tratarse de datos inválidos o socio duplicado
    res.status(400).json({
      error: error.message,
    });
  }
};

// Controlador encargado de manejar la request HTTP
// para modificar los datos de un socio existente
export const actualizarSocioController = async (req, res) => {
  try {
    // Obtiene el ID del socio desde los parámetros de la URL
    const { id } = req.params;

    // Obtiene los datos enviados en el body de la request
    const datosSocio = req.body;

    // Ejecuta el servicio encargado de actualizar el socio en la base de datos
    const socioActualizado = await actualizarSocio(Number(id), datosSocio);

    // Responde con estado 200 indicando que el socio fue actualizado correctamente
    res.status(200).json({
      message: "Socio actualizado correctamente",
      socio: socioActualizado,
    });
  } catch (error) {
    // Muestra el error en consola para facilitar debugging
    console.error(error);

    // Responde con error 400 porque puede tratarse de datos inválidos,
    // socio inexistente o documento duplicado
    res.status(400).json({
      error: error.message,
    });
  }
};

// Controller encargado de devolver el perfil del socio autenticado.
// Usa el id del usuario que fue cargado previamente por el middleware verificarToken.
export const obtenerPerfilSocioController = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const perfil = await obtenerPerfilSocio(usuarioId);

    return res.status(200).json({
      message: "Perfil del socio obtenido correctamente",
      perfil,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

// Controller encargado de cambiar el estado de un socio.
// Centraliza activación, desactivación y suspensión.
export const cambiarEstadoSocioController = async (req, res) => {
  try {
    // Obtiene el id desde los parámetros de la URL.
    const { id } = req.params;

    // Obtiene el nuevo estado enviado en el body.
    const { estado } = req.body;

    // Ejecuta la lógica del service.
    const socioActualizado = await cambiarEstadoSocio(id, estado);

    // Retorna respuesta exitosa.
    res.status(200).json({
      message: "Estado del socio actualizado correctamente",
      socio: socioActualizado,
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
};

// Controller encargado de registrar la aceptación
// del consentimiento informado del socio autenticado.
export const aceptarConsentimientoSocio = async (req, res) => {
  try {
    // El usuario_id se obtiene desde el token JWT,
    // no desde parámetros enviados por el cliente.
    const usuarioId = req.usuario.id;

    const socioActualizado = await aceptarConsentimiento(usuarioId);

    res.status(200).json({
      message: "Consentimiento aceptado correctamente",
      socio: socioActualizado,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};
