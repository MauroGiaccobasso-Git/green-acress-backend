import express from "express";
import { login } from "../controllers/authController.js";
import { verificarToken, autorizarRoles } from "../middlewares/authMiddleware.js";

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

// Ruta protegida de prueba solo para administradores
// Primero valida que exista un token JWT válido
// Luego valida que el usuario autenticado tenga rol ADMIN
router.get("/admin", verificarToken, autorizarRoles("ADMIN"), (req, res) => {
  res.json({
    message: "Acceso autorizado para administrador",
    usuario: req.usuario,
  });
});

export default router;
