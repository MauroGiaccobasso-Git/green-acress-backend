import { loginUsuario } from "../services/authService.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const resultado = await loginUsuario(email, password);

    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    });
  }
};
