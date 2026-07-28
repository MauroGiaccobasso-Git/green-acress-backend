import { enviarEmail } from "./emailProvider.js";
import { generarPasswordTemporalTemplate } from "./templates/passwordTemporalTemplate.js";
import { generarPasswordRecoveryTemplate } from "./templates/passwordRecoveryTemplate.js";

/* =========================================================
   PASSWORD TEMPORAL
========================================================= */

export const enviarPasswordTemporal = async ({
  nombre,
  email,
  passwordTemporal,
}) => {
  const contenido = generarPasswordTemporalTemplate({
    nombre,
    email,
    passwordTemporal,
  });

  await enviarEmail({
    destinatario: email,
    asunto: contenido.subject,
    texto: contenido.text,
    html: contenido.html,
  });
};

/* =========================================================
   RECUPERACIÓN DE PASSWORD
========================================================= */

export const enviarRecuperacionPassword = async ({
  nombre,
  email,
  recoveryUrl,
}) => {
  const contenido = generarPasswordRecoveryTemplate({
    nombre,
    recoveryUrl,
  });

  await enviarEmail({
    destinatario: email,
    asunto: contenido.subject,
    texto: contenido.text,
    html: contenido.html,
  });
};