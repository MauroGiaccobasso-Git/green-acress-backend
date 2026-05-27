// Archivo principal del backend.
import express from "express";

// Crea una instancia de la aplicación Express
// Importa las rutas definidas en el archivo homeRoutes,
// permitiendo utilizarlas dentro del servidor principal
import homeRoutes from "./routes/homeRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import socioRoutes from "./routes/socioRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import productoRoutes from "./routes/productoRoutes.js";
const app = express();

// Define el puerto donde va a correr el servidor
const PORT = 8080;

// Permite manejar datos en formato JSON (por ejemplo en POST)
app.use(express.json());

// Rutas
// Indica que todas las solicitudes a "/" serán manejadas por homeRoutes
// Indica que todas las solicitudes a "/usuarios" serán manejadas por usuarioRoutes
// Indica que todas las solicitudes a "/auth" serán manejadas por authRoutes
// Indica que todas las solicitudes a "/socios" serán manejadas por socioRoutes
app.use("/", homeRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/auth", authRoutes);
app.use("/socios", socioRoutes);
app.use("/productos", productoRoutes);
app.use(errorHandler);

// Inicia el servidor y lo pone a escuchar en el puerto definido
app.listen(PORT, () => {
  // Muestra un mensaje en la consola indicando que el servidor está corriendo
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
