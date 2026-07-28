import { generarBaseEmailTemplate } from "./baseEmailTemplate.js";

import {
  escapeHtml,
  formatearDinero,
  generarCodigoReserva,
} from "./emailTemplateUtils.js";

import {
  generarBloqueTotalReservaHtml,
  generarDetalleReservaHtml,
  generarDetalleReservaTexto,
} from "./reservaDetalleTemplate.js";

export const generarReservaCanceladaTemplate = ({
  nombre,
  reservaId,
  motivo,
  detalles = [],
  total = null,
}) => {
  const codigoReserva = generarCodigoReserva(reservaId);
  const nombreSeguro = escapeHtml(nombre);
  const motivoSeguro = motivo ? escapeHtml(motivo) : null;

  const totalFormateado = formatearDinero(total);

  const detalleTexto = generarDetalleReservaTexto(detalles, {
    mostrarPrecioUnitario: false,
  });

  const detalleHtml = generarDetalleReservaHtml(detalles, {
    titulo: "Detalle de la reserva cancelada",
    mostrarPrecioUnitario: false,
  });

  const bloqueTotal = generarBloqueTotalReservaHtml({
    total,
    etiqueta: "Importe total de referencia",
    destacado: false,
  });

  const subject = "⚠️ Tu reserva fue cancelada | Green Acres";

  const text = `
Hola ${nombre},

Tu reserva fue cancelada.

${
  motivo
    ? `Motivo de la cancelación:
${motivo}

`
    : ""
}${
  detalleTexto
    ? `Detalle de la reserva:
${detalleTexto}

`
    : ""
}${
  totalFormateado
    ? `Importe total de referencia: ${totalFormateado}

`
    : ""
}El stock reservado fue liberado y ya no se encuentra asociado a esta reserva.

Si aún deseás obtener los productos, podrás realizar una nueva reserva siempre que exista disponibilidad.

Código de reserva: ${codigoReserva}

Muchas gracias por confiar en Green Acres.

Equipo Green Acres
`.trim();

  const bloqueMotivo = motivoSeguro
    ? `
<div
  style="
    margin-top:20px;
    background:#F8F9FA;
    padding:20px;
    border-radius:6px;
  "
>
  <p style="margin:0 0 10px 0;">
    <strong>Motivo de la cancelación</strong>
  </p>

  <p style="margin:0;line-height:1.6;">
    ${motivoSeguro}
  </p>
</div>
`
    : "";

  const contenido = `
<div style="margin:32px 0;">

  <div
    style="
      background:#FFF3E0;
      border-left:4px solid #ED6C02;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      La reserva fue cancelada y el stock asociado volvió a estar disponible.
    </p>
  </div>

  ${bloqueMotivo}

  ${detalleHtml}

  ${bloqueTotal}

  <div
    style="
      margin-top:20px;
      background:#F5F5F5;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      Si aún deseás obtener los productos, podrás realizar una nueva reserva
      siempre que exista disponibilidad.
    </p>
  </div>

  <p
    style="
      margin-top:28px;
      font-size:14px;
      color:#666666;
    "
  >
    Código de reserva:
    <strong>${codigoReserva}</strong>
  </p>

</div>
`;

  const html = generarBaseEmailTemplate({
    titulo: "Tu reserva fue cancelada",
    saludo: `Hola ${nombreSeguro},`,
    mensaje:
      "La reserva ya no se encuentra activa y el stock fue liberado correctamente.",
    contenido,
    tipo: "warning",
  });

  return {
    subject,
    text,
    html,
  };
};