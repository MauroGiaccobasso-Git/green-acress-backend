// Archivo principal del backend.
import express from "express";

// Crea una instancia de la aplicación Express
// Importa las rutas definidas en el archivo homeRoutes,
// permitiendo utilizarlas dentro del servidor principal
import homeRoutes from "./routes/homeRoutes.js";
import usuarioRoutes from "./routes/usuario.routes.js";
const app = express();

// Define el puerto donde va a correr el servidor
const PORT = 8080;

// Permite manejar datos en formato JSON (por ejemplo en POST)
app.use(express.json());

// Rutas
// Conecta las rutas importadas al servidor.
// Indica que todas las solicitudes a "/" serán manejadas por homeRoutes
// Indica que todas las solicitudes a "/usuarios" serán manejadas por usuarioRoutes
app.use("/", homeRoutes);
app.use("/usuarios", usuarioRoutes);

// Inicia el servidor y lo pone a escuchar en el puerto definido
app.listen(PORT, () => {
  // Muestra un mensaje en la consola indicando que el servidor está corriendo
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});  