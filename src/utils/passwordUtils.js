    import { randomInt } from "node:crypto";

/* =========================================================
   CONSTANTES
========================================================= */

const MAYUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijklmnopqrstuvwxyz";
const NUMEROS = "0123456789";
const ESPECIALES = "@#$%";

const CARACTERES_DISPONIBLES =
  MAYUSCULAS + MINUSCULAS + NUMEROS + ESPECIALES;

const LONGITUD_PASSWORD_TEMPORAL = 12;

/* =========================================================
   HELPERS INTERNOS
========================================================= */

// Obtiene un carácter aleatorio utilizando generación
// criptográficamente segura provista por Node.js.
const obtenerCaracterAleatorio = (caracteres) => {
  return caracteres[randomInt(0, caracteres.length)];
};

// Mezcla los caracteres mediante Fisher-Yates utilizando randomInt.
const mezclarCaracteres = (caracteres) => {
  const resultado = [...caracteres];

  for (let i = resultado.length - 1; i > 0; i--) {
    const indiceAleatorio = randomInt(0, i + 1);

    [resultado[i], resultado[indiceAleatorio]] = [
      resultado[indiceAleatorio],
      resultado[i],
    ];
  }

  return resultado.join("");
};

/* =========================================================
   GENERACIÓN DE CREDENCIALES
========================================================= */

// Genera una contraseña temporal criptográficamente segura.
//
// Garantiza como mínimo:
// - una letra mayúscula;
// - una letra minúscula;
// - un número;
// - un carácter especial.
//
// La contraseña en texto plano debe existir únicamente durante
// el flujo que la genera y entrega al usuario.
export const generarPasswordTemporal = () => {
  const caracteresPassword = [
    obtenerCaracterAleatorio(MAYUSCULAS),
    obtenerCaracterAleatorio(MINUSCULAS),
    obtenerCaracterAleatorio(NUMEROS),
    obtenerCaracterAleatorio(ESPECIALES),
  ];

  while (caracteresPassword.length < LONGITUD_PASSWORD_TEMPORAL) {
    caracteresPassword.push(
      obtenerCaracterAleatorio(CARACTERES_DISPONIBLES),
    );
  }

  return mezclarCaracteres(caracteresPassword);
};