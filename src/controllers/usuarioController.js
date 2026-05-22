// Importa el servicio que contiene la lógica de consulta de usuarios.
import { getUsuarios } from "../services/usuarioService.js";

// Importa el wrapper reutilizable para capturar errores async
// y derivarlos automáticamente al middleware global errorHandler.
import { asyncHandler } from "../utils/asyncHandler.js";

// Controller encargado de manejar la consulta administrativa de usuarios.
// Se mantiene simple: recibe datos de la request, delega al service y responde.
export const getUsuariosController = asyncHandler(async (req, res) => {
  // Obtiene el parámetro opcional "search" desde la URL.
  // Ejemplo: GET /usuarios?search=juan
  const { search } = req.query;

  // Llama al servicio y le envía el texto de búsqueda.
  // Si search viene vacío, el service devuelve todos los usuarios.
  const usuarios = await getUsuarios(search);

  // Retorna una respuesta JSON clara y consistente.
  return res.status(200).json({
    message: "Usuarios obtenidos correctamente",
    usuarios,
  });
});