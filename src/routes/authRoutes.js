import express from "express";
import { login } from "../controllers/authController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login);

// Ruta protegida de prueba
// Esta ruta utiliza el middleware verificarToken para validar que el usuario esté autenticado
router.get("/perfil", verificarToken, (req, res) => {
  // Si el token es válido, el middleware ya permitió el acceso
  // y agregó la información del usuario en req.usuario

  res.json({
    message: "Acceso autorizado",

    // Se devuelve la información del usuario obtenida desde el token
    // (no desde la base de datos, sino desde lo que se guardó en el JWT)
    usuario: req.usuario,
  });
});

export default router;
