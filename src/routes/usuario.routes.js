// Importa el framework Express
// Express permite definir rutas HTTP y manejar solicitudes del cliente
import express from "express";

// Importa el controlador que contiene la lógica para manejar la request
// En este caso, el controlador que obtiene los usuarios
import { getUsuariosController } from "../controllers/usuario.controller.js";

// Crea una instancia de Router de Express
// El Router permite agrupar rutas relacionadas en un módulo independiente
const router = express.Router();

// Define una ruta GET en la raíz de este router
// Cuando se accede a esta ruta, se ejecuta el controlador getUsuariosController
router.get("/", getUsuariosController);

// Exporta el router para poder ser utilizado en la configuración principal del backend (app.js)
export default router;
