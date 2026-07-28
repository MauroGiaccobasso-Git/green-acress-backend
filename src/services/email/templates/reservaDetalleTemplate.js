import {
  escapeHtml,
  formatearCantidad,
  formatearDinero,
} from "./emailTemplateUtils.js";

/* =========================================================
   DETALLE EN TEXTO PLANO
========================================================= */

export const generarDetalleReservaTexto = (
  detalles = [],
  { mostrarPrecioUnitario = true } = {},
) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return "";
  }

  return detalles
    .map((detalle) => {
      const nombreProducto =
        detalle?.producto?.nombre ?? "Producto sin nombre";

      const cantidad = formatearCantidad(
        detalle?.cantidad,
        detalle?.producto?.unidad_medida,
      );

      const precioUnitario = formatearDinero(detalle?.precio_unitario);
      const subtotal = formatearDinero(detalle?.subtotal);

      const precioTexto =
        mostrarPrecioUnitario && precioUnitario
          ? ` — Precio unitario: ${precioUnitario}`
          : "";

      const subtotalTexto = subtotal ? ` — Importe: ${subtotal}` : "";

      return `- ${nombreProducto}: ${cantidad}${precioTexto}${subtotalTexto}`;
    })
    .join("\n");
};

/* =========================================================
   FILAS HTML
========================================================= */

const generarFilasDetalleReserva = (
  detalles,
  { mostrarPrecioUnitario },
) =>
  detalles
    .map((detalle) => {
      const nombreProducto = escapeHtml(
        detalle?.producto?.nombre ?? "Producto sin nombre",
      );

      const cantidad = formatearCantidad(
        detalle?.cantidad,
        detalle?.producto?.unidad_medida,
      );

      const precioUnitario =
        formatearDinero(detalle?.precio_unitario) ?? "—";

      const subtotal = formatearDinero(detalle?.subtotal) ?? "—";

      return `
<tr>
  <td
    style="
      padding:14px 0;
      border-bottom:1px solid #E5E7EB;
      vertical-align:top;
    "
  >
    <strong style="color:#1F2937;">
      ${nombreProducto}
    </strong>
  </td>

  <td
    align="center"
    style="
      padding:14px 10px;
      border-bottom:1px solid #E5E7EB;
      color:#4B5563;
      white-space:nowrap;
      vertical-align:top;
    "
  >
    ${cantidad}
  </td>

  ${
    mostrarPrecioUnitario
      ? `
  <td
    align="right"
    style="
      padding:14px 10px;
      border-bottom:1px solid #E5E7EB;
      color:#4B5563;
      white-space:nowrap;
      vertical-align:top;
    "
  >
    ${precioUnitario}
  </td>
  `
      : ""
  }

  <td
    align="right"
    style="
      padding:14px 0;
      border-bottom:1px solid #E5E7EB;
      color:#1F2937;
      white-space:nowrap;
      vertical-align:top;
    "
  >
    <strong>${subtotal}</strong>
  </td>
</tr>
`;
    })
    .join("");

/* =========================================================
   TABLA HTML
========================================================= */

export const generarDetalleReservaHtml = (
  detalles = [],
  {
    titulo = "Detalle de la reserva",
    mostrarPrecioUnitario = true,
  } = {},
) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return "";
  }

  const filas = generarFilasDetalleReserva(detalles, {
    mostrarPrecioUnitario,
  });

  return `
<div
  style="
    margin-top:20px;
    padding:20px;
    background:#FFFFFF;
    border:1px solid #E5E7EB;
    border-radius:6px;
  "
>
  <p style="margin:0 0 14px 0;">
    <strong>${escapeHtml(titulo)}</strong>
  </p>

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="
      width:100%;
      border-collapse:collapse;
      font-size:14px;
    "
  >
    <thead>
      <tr>
        <th
          align="left"
          style="
            padding:10px 0;
            border-bottom:2px solid #D1D5DB;
            color:#6B7280;
            font-size:11px;
            text-transform:uppercase;
          "
        >
          Producto
        </th>

        <th
          align="center"
          style="
            padding:10px;
            border-bottom:2px solid #D1D5DB;
            color:#6B7280;
            font-size:11px;
            text-transform:uppercase;
          "
        >
          Cantidad
        </th>

        ${
          mostrarPrecioUnitario
            ? `
        <th
          align="right"
          style="
            padding:10px;
            border-bottom:2px solid #D1D5DB;
            color:#6B7280;
            font-size:11px;
            text-transform:uppercase;
          "
        >
          Precio
        </th>
        `
            : ""
        }

        <th
          align="right"
          style="
            padding:10px 0;
            border-bottom:2px solid #D1D5DB;
            color:#6B7280;
            font-size:11px;
            text-transform:uppercase;
          "
        >
          Importe
        </th>
      </tr>
    </thead>

    <tbody>
      ${filas}
    </tbody>
  </table>
</div>
`;
};

/* =========================================================
   BLOQUE TOTAL HTML
========================================================= */

export const generarBloqueTotalReservaHtml = ({
  total,
  etiqueta = "Importe total",
  destacado = false,
}) => {
  const totalFormateado = formatearDinero(total);

  if (!totalFormateado) {
    return "";
  }

  const background = destacado ? "#F0F7F1" : "#F8F9FA";
  const color = destacado ? "#2E7D32" : "#1F2937";
  const fontSize = destacado ? "22px" : "20px";

  return `
<div
  style="
    margin-top:16px;
    padding:16px 20px;
    background:${background};
    border-radius:6px;
    text-align:right;
  "
>
  <span style="font-size:14px;color:#6B7280;">
    ${escapeHtml(etiqueta)}
  </span>

  <div
    style="
      margin-top:4px;
      font-size:${fontSize};
      font-weight:bold;
      color:${color};
    "
  >
    ${totalFormateado}
  </div>
</div>
`;
};