// Archivo utilitario encargado de centralizar las validaciones
// de integridad de datos utilizadas por los distintos módulos del sistema.
//
// Su objetivo es reutilizar reglas de validación comunes,
// mantener los servicios más limpios y evitar duplicación de lógica.

// Valida que el email tenga un formato válido.
// Se utiliza una expresión regular básica para verificar estructura general.
export const validarEmail = (email) => {
  // Expresión regular simple para validar emails.
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Retorna true si cumple el formato.
  return regexEmail.test(email);
};

// Valida que la contraseña tenga una longitud mínima segura.
export const validarPassword = (password) => {
  return password.length >= 8;
};

// Valida que el documento tenga únicamente números
// y una longitud válida para cédulas uruguayas.
export const validarDocumento = (documento) => {
  // Expresión regular:
  // solo números entre 7 y 8 dígitos.
  const regexDocumento = /^\d{7,8}$/;

  return regexDocumento.test(documento);
};
// Valida que el teléfono contenga únicamente números
// y una longitud razonable para teléfonos reales.
export const validarTelefono = (telefono) => {
  // Solo números entre 8 y 15 caracteres.
  const regexTelefono = /^\d{8,15}$/;

  return regexTelefono.test(telefono);
};

// Valida nombres y apellidos.
// Permite letras, espacios y tildes.
export const validarTexto = (texto) => {

  // Expresión regular para textos alfabéticos simples.
  const regexTexto = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,50}$/;

  return regexTexto.test(texto);
};  

// Valida estados permitidos dentro del sistema.
export const validarEstado = (estado) => {

  // Estados válidos definidos para usuarios y socios.
  const estadosValidos = ["ACTIVO", "INACTIVO", "SUSPENDIDO"];

  return estadosValidos.includes(estado);
};


