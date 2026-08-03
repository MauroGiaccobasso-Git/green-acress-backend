import { generarBaseEmailTemplate } from "./baseEmailTemplate.js";
import { escapeHtml } from "./emailTemplateUtils.js";

/* =========================================================
   HELPERS INTERNOS
========================================================= */

const normalizarTexto = (valor, fallback = "") => {
  const texto = String(valor ?? "").trim();

  return texto || fallback;
};

const convertirSaltosDeLineaAHtml = (valor) =>
  escapeHtml(valor).replace(/\r\n|\r|\n/g, "<br />");

/* =========================================================
   TEMPLATE DE NOVEDAD PUBLICADA
========================================================= */

export const generarNovedadPublicadaTemplate = ({
  nombre,
  titulo,
  contenido,
  fechaPublicacion = null,
}) => {
  const nombreNormalizado = normalizarTexto(nombre, "socio/a");
  const tituloNormalizado = normalizarTexto(titulo, "Nueva novedad");
  const contenidoNormalizado = normalizarTexto(contenido);

  const tituloSeguro = escapeHtml(tituloNormalizado);
  const contenidoSeguro = convertirSaltosDeLineaAHtml(
    contenidoNormalizado,
  );

  const fechaPublicacionNormalizada = fechaPublicacion
    ? normalizarTexto(fechaPublicacion)
    : null;

  const fechaPublicacionSegura = fechaPublicacionNormalizada
    ? escapeHtml(fechaPublicacionNormalizada)
    : null;

  const subject = "🌿 Nueva novedad publicada | Green Acres";

  const text = `
Hola ${nombreNormalizado},

El club publicó una nueva novedad:

${tituloNormalizado}

${contenidoNormalizado}

${
  fechaPublicacionNormalizada
    ? `Fecha de publicación: ${fechaPublicacionNormalizada}

`
    : ""
}También podés consultar esta información desde tu portal de socio.

Muchas gracias por confiar en Green Acres.

Equipo Green Acres
`.trim();

  const bloqueFechaPublicacion = fechaPublicacionSegura
    ? `
<div
  style="
    margin-top:20px;
    padding:16px 20px;
    background:#F8F9FA;
    border-radius:6px;
  "
>
  <p
    style="
      margin:0;
      color:#4B5563;
      font-size:14px;
      line-height:1.6;
    "
  >
    <strong>Fecha de publicación:</strong>
    ${fechaPublicacionSegura}
  </p>
</div>
`
    : "";

  const contenidoHtml = `
<div style="margin:32px 0;">

  <div
    style="
      padding:20px;
      background:#F0F7F1;
      border-left:4px solid #2E7D32;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      El club publicó nueva información para sus socios.
    </p>
  </div>

  <div
    style="
      margin-top:20px;
      padding:24px;
      background:#FFFFFF;
      border:1px solid #E5E7EB;
      border-radius:6px;
    "
  >
    <p
      style="
        margin:0 0 10px 0;
        color:#6B7280;
        font-size:12px;
        font-weight:bold;
        letter-spacing:0.5px;
        text-transform:uppercase;
      "
    >
      Novedad
    </p>

    <h3
      style="
        margin:0 0 18px 0;
        color:#1F2937;
        font-size:22px;
        line-height:1.4;
        overflow-wrap:anywhere;
      "
    >
      ${tituloSeguro}
    </h3>

    <p
      style="
        margin:0;
        color:#374151;
        font-size:16px;
        line-height:1.7;
        overflow-wrap:anywhere;
      "
    >
      ${contenidoSeguro}
    </p>
  </div>

  ${bloqueFechaPublicacion}

  <div
    style="
      margin-top:20px;
      padding:18px;
      background:#F5F5F5;
      border-radius:6px;
    "
  >
    <p style="margin:0;line-height:1.6;">
      También podés consultar esta novedad desde tu portal de socio.
    </p>
  </div>

</div>
`;

  const html = generarBaseEmailTemplate({
    titulo: "Nueva novedad disponible",
    saludo: `Hola ${nombreNormalizado},`,
    mensaje:
      "Tenemos nueva información del club para compartir contigo.",
    contenido: contenidoHtml,
    tipo: "success",
  });

  return {
    subject,
    text,
    html,
  };
};