// Archivo principal del backend.
// Este archivo funciona como punto de entrada de la aplicación,
// donde se configurará el servidor, rutas y lógica inicial.
// Importa la librería Express para poder crear el servidor
const express = require("express");
// Crea una instancia de la aplicación Express
// Importa las rutas definidas en el archivo homeRoutes,
// permitiendo utilizarlas dentro del servidor principal
const homeRoutes = require("./routes/homeRoutes");
const app = express();
// Define el puerto donde va a correr el servidor
const PORT = 3000;
// Permite manejar datos en formato JSON (por ejemplo en POST)
app.use(express.json());
// Conecta las rutas importadas al servidor.
// Indica que todas las solicitudes a "/" serán manejadas por homeRoutes
app.use("/", homeRoutes);
// Inicia el servidor y lo pone a escuchar en el puerto definido
app.listen(PORT, () => {
  // Muestra un mensaje en la consola indicando que el servidor está corriendo
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
