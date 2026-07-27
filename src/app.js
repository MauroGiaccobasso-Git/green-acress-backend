import "dotenv/config";

import cors from "cors";
import express from "express";

import { iniciarReservationExpirationJob } from "./jobs/reservationExpirationJob.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import compraRoutes from "./routes/compraRoutes.js";
import homeRoutes from "./routes/homeRoutes.js";
import productoRoutes from "./routes/productoRoutes.js";
import proveedorRoutes from "./routes/proveedorRoutes.js";
import reservaRoutes from "./routes/reservaRoutes.js";
import socioRoutes from "./routes/socioRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import usuarioRoutes from "./routes/usuarioRoutes.js";
import ventaRoutes from "./routes/ventaRoutes.js";
import novedadRoutes from "./routes/novedadRoutes.js";

/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

const app = express();
const PORT = process.env.PORT || 8080;


/* =========================================================
   MIDDLEWARES GLOBALES
========================================================= */

// Permite la comunicación entre el frontend y el backend.
app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

// Permite procesar cuerpos JSON enviados al backend.
app.use(express.json());


/* =========================================================
   RUTAS DEL SISTEMA
========================================================= */

app.use("/", homeRoutes);
app.use("/auth", authRoutes);
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

app.use(errorHandler);


/* =========================================================
   INICIO DEL SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);

  iniciarReservationExpirationJob();
});