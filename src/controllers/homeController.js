import prisma from "../config/prisma.js";

// Respuesta de la ruta principal.
export const getHome = (req, res) => {
  res.send("Respuesta desde el controlador");
};

// Ruta simple para comprobar que Express responde.
export const getTest = (req, res) => {
  res.send("Ruta de prueba funcionando");
};

// Comprueba que el backend y PostgreSQL estén funcionando.
export const getHealth = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Error en el control de salud:", error);

    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
};