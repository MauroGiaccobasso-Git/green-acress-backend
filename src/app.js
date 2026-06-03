// Archivo principal del backend.
import express from "express";
import cors from "cors";

// Routes
import homeRoutes from "./routes/homeRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import socioRoutes from "./routes/socioRoutes.js";
import productoRoutes from "./routes/productoRoutes.js";
import proveedorRoutes from "./routes/proveedorRoutes.js";

// Middlewares
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

const PORT = 8080;

// Permite comunicación entre frontend y backend.
app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

// Permite procesar cuerpos JSON enviados al backend.
app.use(express.json());

// Configuración de rutas principales del sistema.
app.use("/", homeRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/auth", authRoutes);
app.use("/socios", socioRoutes);
app.use("/productos", productoRoutes);
app.use("/proveedores", proveedorRoutes);

// Middleware global para manejo centralizado de errores.
app.use(errorHandler);

// Inicia servidor HTTP.
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
