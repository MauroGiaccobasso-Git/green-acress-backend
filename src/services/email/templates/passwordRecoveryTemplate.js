export const generarPasswordRecoveryTemplate = ({
  nombre,
  recoveryUrl,
}) => {
  const subject = "Green Acres - Recuperación de contraseña";

  const text = `
Hola ${nombre},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en Green Acres.

Para continuar, ingresá al siguiente enlace:

${recoveryUrl}

Este enlace vence en 30 minutos y puede utilizarse una sola vez.

Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña actual seguirá siendo válida.

Saludos,
Equipo de Green Acres
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
          <tr>
            <td>

              <h1 style="margin-top:0;color:#2E7D32;">
                Green Acres
              </h1>

              <p>Hola <strong>${nombre}</strong>,</p>

              <p>
                Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              </p>

              <p style="margin:30px 0;">
                <a
                  href="${recoveryUrl}"
                  style="display:inline-block;padding:12px 20px;background:#2E7D32;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;"
                >
                  Restablecer contraseña
                </a>
              </p>

              <p style="color:#c62828;">
                Este enlace vence en 30 minutos y puede utilizarse una sola vez.
              </p>

              <p>
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:
              </p>

              <p style="word-break:break-all;">
                ${recoveryUrl}
              </p>

              <hr style="margin:30px 0;">

              <p style="font-size:13px;color:#666;">
                Si no solicitaste este cambio, ignorá este correo. Tu contraseña actual seguirá siendo válida.
              </p>

              <p style="font-size:13px;color:#666;">
                Este es un correo automático. Por favor, no respondas este mensaje.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return {
    subject,
    text,
    html,
  };
};