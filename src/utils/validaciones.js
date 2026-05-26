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

/*
  Valida los datos necesarios para registrar o modificar un producto.

  Esta función centraliza las validaciones del módulo de productos para evitar
  repetir lógica dentro de controllers o services.

  Reglas validadas:
  - El nombre es obligatorio.
  - El tipo es obligatorio.
  - La unidad de medida es obligatoria.
  - El precio de venta debe ser numérico y mayor a cero.
*/
export const validarDatosProducto = (producto) => {
  const { nombre, tipo, unidad_medida, precio_venta_actual } = producto;

  // Valida que el nombre exista y no sea un texto vacío.
  if (!nombre || nombre.trim() === "") {
    throw new Error("El nombre del producto es obligatorio");
  }

  // Valida que el tipo exista y no sea un texto vacío.
  // Por ahora se mantiene como String; luego se definirá si corresponde
  // modelarlo como categoría, genética u otro atributo del dominio.
  if (!tipo || tipo.trim() === "") {
    throw new Error("El tipo de producto es obligatorio");
  }

  // Valida que la unidad de medida exista.
  // Ejemplo esperado para el MVP: GRAMOS.
  if (!unidad_medida || unidad_medida.trim() === "") {
    throw new Error("La unidad de medida es obligatoria");
  }

  // Valida que el precio exista, sea numérico y mayor a cero.
  if (
    precio_venta_actual === undefined ||
    precio_venta_actual === null ||
    Number.isNaN(Number(precio_venta_actual)) ||
    Number(precio_venta_actual) <= 0
  ) {
    throw new Error("El precio de venta debe ser un número mayor a cero");
  }
};