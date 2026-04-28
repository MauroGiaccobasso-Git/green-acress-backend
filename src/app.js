// Archivo principal del backend.
// Este archivo funciona como punto de entrada de la aplicación,
// donde se configurará el servidor, rutas y lógica inicial.

// Importa la librería Express para poder crear el servidor
const express = require('express');

// Crea una instancia de la aplicación Express
const app = express();

// Define el puerto donde va a correr el servidor
const PORT = 3000;

// Define una ruta GET para la raíz (/)
// Cuando alguien entra a http://localhost:3000/
app.get('/', (req, res) => {
  // Responde con un mensaje en el navegador
  res.send('Servidor funcionando');
});

// Inicia el servidor y lo pone a escuchar en el puerto definido
app.listen(PORT, () => {
  // Muestra un mensaje en la consola indicando que el servidor está corriendo
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});