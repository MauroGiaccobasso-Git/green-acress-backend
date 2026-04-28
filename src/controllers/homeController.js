// Controlador de la ruta principal.
// Este archivo contiene la lógica que maneja las solicitudes
// hacia la ruta raíz ("/") y define la respuesta del servidor.
// Función que maneja la lógica de la ruta principal ("/")
const getHome = (req, res) => {
  // Envía una respuesta al navegador cuando alguien accede a la ruta "/"
  res.send("Respuesta desde el controlador");
};
// Función para una ruta de prueba
const getTest = (req, res) => {
  res.send('Ruta de prueba funcionando');
};
// Exporta la función para poder usarla en otros archivos (por ejemplo en routes)
module.exports = {
  getHome,
  getTest
};
