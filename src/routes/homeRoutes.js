// Definición de las rutas del sistema.
// Este archivo se encarga de asociar las URLs con los controladores correspondientes,
// redirigiendo las solicitudes del usuario hacia la lógica que procesa cada petición.
// Importa express para poder usar el sistema de rutas
const express = require("express");

// Crea un router (objeto que maneja rutas)
const router = express.Router();

// Importa la función del controller
const { getHome, getTest } = require("../controllers/homeController");

// Define la ruta GET para "/"
// Cuando alguien accede a "/", se ejecuta getHome
router.get("/", getHome);

// Define la ruta GET para "/test"
// Cuando alguien accede a "/test", se ejecuta la función getTest
router.get('/test', getTest);

// Exporta el router para poder usarlo en app.js
module.exports = router;
