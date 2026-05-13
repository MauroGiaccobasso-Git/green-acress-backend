// Importa el servicio que contiene la lógica de acceso a la base de datos.
// En este caso, el servicio permite obtener usuarios y aplicar búsqueda.
import { getUsuarios } from "../services/usuarioService.js";

// Controller encargado de manejar la request HTTP.
// Recibe la solicitud (req) y construye la respuesta (res).
export const getUsuariosController = async (req, res) => {
  try {
    // Obtiene el parámetro opcional "search" desde la URL.
    // Ejemplo: GET /usuarios?search=juan
    const { search } = req.query;

    // Llama al servicio y le envía el texto de búsqueda.
    // Si search viene vacío, el service devuelve todos los usuarios.
    const usuarios = await getUsuarios(search);

    // Retorna una respuesta JSON más clara y consistente.
    res.status(200).json({
      message: "Usuarios obtenidos correctamente",
      usuarios,
    });
  } catch (error) {
    // En caso de error, retorna un status 500.
    res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message,
    });
  }
};