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

export const generarReservaVencidaTemplate = ({
  nombre,
  reservaId,
  detalles = [],
  total = null,
}) => {
  const codigoReserva = generarCodigoReserva(reservaId);
  const nombreSeguro = escapeHtml(nombre);

  const totalFormateado = formatearDinero(total);

  const detalleTexto = generarDetalleReservaTexto(detalles, {
    mostrarPrecioUnitario: true,
  });

  const detalleHtml = generarDetalleReservaHtml(detalles, {
    titulo: "Detalle de la reserva vencida",
    mostrarPrecioUnitario: true,
  });

  const bloqueTotal = generarBloqueTotalReservaHtml({
    total,
    etiqueta: "Importe total de referencia",
    destacado: false,
  });

  const subject = "⌛ Tu reserva venció | Green Acres";

  const text = `
Hola ${nombre},

Tu reserva venció porque no fue retirada dentro del plazo establecido.

${
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
}El stock reservado fue liberado automáticamente y ya no se encuentra asociado a la reserva.

Si aún deseás obtener los productos, podrás realizar una nueva reserva siempre que exista disponibilidad.

Código de reserva: ${codigoReserva}

Muchas gracias por confiar en Green Acres.

Equipo Green Acres
`.trim();

  const contenido = `
<div style="margin:32px 0;">

  <div
    style="
      background:#FFF8E1;
      border-left:4px solid #ED6C02;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      La reserva no fue retirada dentro del plazo establecido y venció
      automáticamente.
    </p>
  </div>

  ${detalleHtml}

  ${bloqueTotal}

  <div
    style="
      margin-top:20px;
      background:#F8F9FA;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      El stock reservado fue liberado y volvió a estar disponible para nuevas
      reservas.
    </p>
  </div>

  <div
    style="
      margin-top:20px;
      background:#F5F5F5;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      Si todavía deseás obtener los productos, podrás generar una nueva reserva
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
    titulo: "Tu reserva venció",
    saludo: `Hola ${nombreSeguro},`,
    mensaje:
      "La reserva superó el plazo máximo de retiro y dejó de estar disponible automáticamente.",
    contenido,
    tipo: "warning",
  });

  return {
    subject,
    text,
    html,
  };
};