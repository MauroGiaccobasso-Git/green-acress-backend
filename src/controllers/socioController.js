// Importa el servicio encargado de consultar los socios
// El controlador delega la lógica de acceso a datos al service
import { obtenerSocios, crearSocio, actualizarSocio, desactivarSocio } from "../services/socioService.js";

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

// Controlador encargado de manejar la request HTTP
// para desactivar lógicamente un socio
export const desactivarSocioController = async (req, res) => {
  try {
    // Obtiene el ID enviado por parámetro
    const { id } = req.params;

    // Ejecuta el servicio encargado de desactivar el socio
    const socioDesactivado = await desactivarSocio(Number(id));

    // Respuesta exitosa
    res.status(200).json({
      message: "Socio desactivado correctamente",
      socio: socioDesactivado,
    });
  } catch (error) {
    // Debug en consola
    console.error(error);

    // Error controlado
    res.status(400).json({
      error: error.message,
    });
  }
};