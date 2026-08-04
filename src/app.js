import "dotenv/config";

import cors from "cors";
import express from "express";

import { iniciarReservationExpirationJob } from "./jobs/reservationExpirationJob.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import compraRoutes from "./routes/compraRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import homeRoutes from "./routes/homeRoutes.js";
import mfaRoutes from "./routes/mfaRoutes.js";
import novedadRoutes from "./routes/novedadRoutes.js";
import productoRoutes from "./routes/productoRoutes.js";
import proveedorRoutes from "./routes/proveedorRoutes.js";
import reservaRoutes from "./routes/reservaRoutes.js";
import socioRoutes from "./routes/socioRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import ventaRoutes from "./routes/ventaRoutes.js";

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const app = express();

const PORT = process.env.PORT || 8080;
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:3000";

/* =========================================================
   MIDDLEWARES GLOBALES
========================================================= */

// Permite solicitudes únicamente desde el frontend configurado.
// En desarrollo utiliza http://localhost:3000 como respaldo.
app.use(
  cors({
    origin: FRONTEND_URL,
  }),
);

// Permite procesar cuerpos JSON enviados al backend.
app.use(express.json());

/* =========================================================
   RUTAS DEL SISTEMA
========================================================= */

app.use("/", homeRoutes);

app.use("/auth", authRoutes);
app.use("/auth/mfa", mfaRoutes);

app.use("/dashboard", dashboardRoutes);

app.use("/usuarios", usuarioRoutes);
app.use("/socios", socioRoutes);
app.use("/productos", productoRoutes);
app.use("/proveedores", proveedorRoutes);
app.use("/compras", compraRoutes);
app.use("/ventas", ventaRoutes);
app.use("/stock", stockRoutes);
app.use("/reservas", reservaRoutes);
app.use("/novedades", novedadRoutes);

/* =========================================================
   MANEJO GLOBAL DE ERRORES
========================================================= */

// Debe registrarse después de todas las rutas para capturar
// y normalizar los errores producidos por cualquier módulo.
app.use(errorHandler);

/* =========================================================
   INICIO DEL SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);

  iniciarReservationExpirationJob();
});