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

export const generarReservaConfirmadaTemplate = ({
  nombre,
  reservaId,
  fechaLimiteRetiro,
  detalles = [],
  total = null,
}) => {
  const codigoReserva = generarCodigoReserva(reservaId);
  const nombreSeguro = escapeHtml(nombre);
  const fechaLimiteSegura = escapeHtml(fechaLimiteRetiro);

  const totalFormateado = formatearDinero(total);

  const detalleTexto = generarDetalleReservaTexto(detalles, {
    mostrarPrecioUnitario: true,
  });

  const detalleHtml = generarDetalleReservaHtml(detalles, {
    titulo: "Detalle de la reserva",
    mostrarPrecioUnitario: true,
  });

  const bloqueTotal = generarBloqueTotalReservaHtml({
    total,
    etiqueta: "Importe total",
    destacado: true,
  });

  const subject = "🌿 Tu reserva fue confirmada | Green Acres";

  const text = `
Hola ${nombre},

¡Tu reserva fue confirmada con éxito!

Ya reservamos el stock para que puedas retirarlo dentro del plazo establecido.

${
  detalleTexto
    ? `Detalle de la reserva:
${detalleTexto}

`
    : ""
}${
  totalFormateado
    ? `Importe total: ${totalFormateado}

`
    : ""
}Fecha límite de retiro:
${fechaLimiteRetiro}

Si no retirás tu reserva antes de esa fecha, vencerá automáticamente y el stock reservado volverá a estar disponible.

Código de reserva: ${codigoReserva}

Muchas gracias por confiar en Green Acres.

Equipo Green Acres
`.trim();

  const contenido = `
<div style="margin:32px 0;">

  <div
    style="
      background:#F0F7F1;
      border-left:4px solid #2E7D32;
      padding:20px;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      Ya reservamos el stock para vos. Solo resta que concurras al club
      antes de la fecha límite para retirarlo.
    </p>
  </div>

  ${detalleHtml}

  ${bloqueTotal}

  <div
    style="
      margin-top:20px;
      padding:20px;
      background:#F8F9FA;
      border-radius:6px;
    "
  >
    <p style="margin:0 0 8px 0;color:#4B5563;">
      <strong>Fecha límite de retiro</strong>
    </p>

    <p
      style="
        margin:0;
        font-size:20px;
        font-weight:bold;
        color:#2E7D32;
      "
    >
      ${fechaLimiteSegura}
    </p>
  </div>

  <div
    style="
      margin-top:20px;
      padding:18px;
      background:#FFF8E1;
      border-left:4px solid #ED6C02;
      border-radius:6px;
    "
  >
    <strong>Importante</strong>

    <p style="margin:10px 0 0 0;line-height:1.6;">
      Si no retirás tu reserva antes de la fecha indicada, vencerá
      automáticamente y el stock reservado volverá a estar disponible.
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
    titulo: "¡Tu reserva fue confirmada! 🎉",
    saludo: `Hola ${nombreSeguro},`,
    mensaje:
      "La reserva fue procesada correctamente y el stock ya quedó apartado para vos.",
    contenido,
    tipo: "success",
  });

  return {
    subject,
    text,
    html,
  };
};