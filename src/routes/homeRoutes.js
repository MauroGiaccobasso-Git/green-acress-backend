// Importa Express para crear las rutas.
import express from "express";

// Importa las funciones que responderán cada ruta.
import {
  getHealth,
  getHome,
  getTest,
} from "../controllers/homeController.js";

const router = express.Router();

// Ruta principal.
router.get("/", getHome);

// Ruta de prueba básica.
router.get("/test", getTest);

// Comprueba que el backend y la base de datos funcionen.
router.get("/health", getHealth);

export default router;