// Controlador de la ruta principal.
// Este archivo contiene la lógica que maneja las solicitudes HTTP
// hacia la ruta raíz ("/") y otras rutas de prueba.

// Función que maneja la lógica de la ruta principal ("/")
// Recibe la request (req) y envía una respuesta (res)
export const getHome = (req, res) => {
  // Envía una respuesta al cliente cuando accede a la ruta "/"
  res.send("Respuesta desde el controlador");
};

// Función que maneja una ruta de prueba
// Permite validar que el backend está funcionando correctamente
export const getTest = (req, res) => {
  res.send("Ruta de prueba funcionando");
};