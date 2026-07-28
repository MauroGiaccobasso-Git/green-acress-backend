export const escapeHtml = (valor = "") =>
  String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const formatearDinero = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numero);
};

export const formatearNumero = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return String(valor ?? "");
  }

  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 2,
  }).format(numero);
};

export const formatearCantidad = (cantidad, unidadMedida) => {
  const cantidadFormateada = formatearNumero(cantidad);

  return unidadMedida
    ? `${cantidadFormateada} ${escapeHtml(unidadMedida)}`
    : cantidadFormateada;
};

export const generarCodigoReserva = (reservaId) =>
  `RA-${String(reservaId).padStart(6, "0")}`;