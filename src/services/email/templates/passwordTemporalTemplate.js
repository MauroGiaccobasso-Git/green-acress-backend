export const generarPasswordTemporalTemplate = ({
  nombre,
  email,
  passwordTemporal,
}) => {
  const subject = "Bienvenido a Green Acres - Credenciales de acceso";

  const text = `
Hola ${nombre},

Tu cuenta fue creada correctamente en Green Acres.

A continuación encontrarás tus credenciales de acceso:

Correo electrónico:
${email}

Contraseña temporal:
${passwordTemporal}

Por motivos de seguridad, deberás cambiar esta contraseña al iniciar sesión por primera vez.

Si no solicitaste esta cuenta o creés que recibiste este correo por error, comunicate con la administración del club.

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
                Tu cuenta fue creada correctamente.
              </p>

              <p>
                Estas son tus credenciales de acceso:
              </p>

              <table cellpadding="8" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">
                <tr>
                  <td><strong>Correo:</strong></td>
                  <td>${email}</td>
                </tr>
                <tr>
                  <td><strong>Contraseña temporal:</strong></td>
                  <td><strong>${passwordTemporal}</strong></td>
                </tr>
              </table>

              <p style="color:#c62828;">
                Por seguridad deberás cambiar esta contraseña durante tu primer inicio de sesión.
              </p>

              <hr style="margin:30px 0;">

              <p style="font-size:13px;color:#666;">
                Si no esperabas este correo, comunicate con la administración del club.
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