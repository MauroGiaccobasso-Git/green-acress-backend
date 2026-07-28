const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const obtenerColor = (tipo) => {
  switch (tipo) {
    case "success":
      return "#2E7D32";
    case "warning":
      return "#ED6C02";
    case "error":
      return "#D32F2F";
    default:
      return "#2E7D32";
  }
};

export const generarBaseEmailTemplate = ({
  titulo,
  saludo,
  mensaje,
  contenido,
  tipo = "success",
}) => {
  const color = obtenerColor(tipo);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(titulo)}</title>
</head>

<body style="
    margin:0;
    padding:32px;
    background:#F5F5F5;
    font-family:Arial, Helvetica, sans-serif;
    color:#333333;
">

<table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    width="100%"
    style="max-width:650px;margin:auto;"
>

<tr>
<td>

<div
style="
background:${color};
padding:24px;
text-align:center;
border-radius:10px 10px 0 0;
">

<h1 style="
margin:0;
color:#FFFFFF;
font-size:28px;
font-weight:bold;
">
🌿 Green Acres
</h1>

</div>

<div
style="
background:#FFFFFF;
padding:36px;
border:1px solid #E5E5E5;
">

<h2 style="
margin-top:0;
font-size:24px;
color:${color};
">
${escapeHtml(titulo)}
</h2>

<p style="font-size:16px;">
${escapeHtml(saludo)}
</p>

<p
style="
font-size:16px;
line-height:1.7;
margin-bottom:28px;
">
${mensaje}
</p>

${contenido}

<hr
style="
margin:32px 0;
border:none;
border-top:1px solid #E5E5E5;
">

<p
style="
font-size:14px;
color:#666666;
line-height:1.7;
margin-bottom:8px;
">
Si tenés alguna consulta o necesitás asistencia,
podés comunicarte con el club.
</p>

<p
style="
font-size:14px;
color:#666666;
margin-top:20px;
">
Muchas gracias por confiar en <strong>Green Acres</strong>.
</p>

<p
style="
margin-top:28px;
font-weight:bold;
">
Equipo Green Acres
</p>

</div>

<div
style="
padding:20px;
text-align:center;
font-size:12px;
color:#888888;
">
Este es un correo automático. Por favor, no lo respondas.
</div>

</td>
</tr>

</table>

</body>
</html>
`;
};