// Importa el servicio que contiene la lógica de acceso a la base de datos
// En este caso, el servicio que obtiene todos los usuarios
import { getUsuarios } from "../services/usuarioService.js";

// Controller encargado de manejar la request HTTP
// Recibe la solicitud (req) y construye la respuesta (res)
export const getUsuariosController = async (req, res) => {
  try {
    // Llama al servicio para obtener los usuarios desde la base de datos
    const usuarios = await getUsuarios();

    // Retorna los usuarios en formato JSON al cliente
    res.json(usuarios);
  } catch (error) {
    // En caso de error, retorna un status 500 (error del servidor)
    // junto con un mensaje genérico
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};
