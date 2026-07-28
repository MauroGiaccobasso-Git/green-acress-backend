import { enviarEmail } from "./emailProvider.js";

import { generarPasswordTemporalTemplate } from "./templates/passwordTemporalTemplate.js";
import { generarPasswordRecoveryTemplate } from "./templates/passwordRecoveryTemplate.js";
import { generarReservaConfirmadaTemplate } from "./templates/reservaConfirmadaTemplate.js";
import { generarReservaCanceladaTemplate } from "./templates/reservaCanceladaTemplate.js";
import { generarReservaVencidaTemplate } from "./templates/reservaVencidaTemplate.js";

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

/* =========================================================
   RESERVA CONFIRMADA
========================================================= */

export const enviarReservaConfirmada = async ({
  nombre,
  email,
  reservaId,
  fechaLimiteRetiro,
  detalles,
  total,
}) => {
  const contenido = generarReservaConfirmadaTemplate({
    nombre,
    reservaId,
    fechaLimiteRetiro,
    detalles,
    total,
  });

  await enviarEmail({
    destinatario: email,
    asunto: contenido.subject,
    texto: contenido.text,
    html: contenido.html,
  });
};

/* =========================================================
   RESERVA CANCELADA
========================================================= */

export const enviarReservaCancelada = async ({
  nombre,
  email,
  reservaId,
  motivo,
  detalles,
  total,
}) => {
  const contenido = generarReservaCanceladaTemplate({
    nombre,
    reservaId,
    motivo,
    detalles,
    total,
  });

  await enviarEmail({
    destinatario: email,
    asunto: contenido.subject,
    texto: contenido.text,
    html: contenido.html,
  });
};

/* =========================================================
   RESERVA VENCIDA
========================================================= */

export const enviarReservaVencida = async ({
  nombre,
  email,
  reservaId,
  detalles,
  total,
}) => {
  const contenido = generarReservaVencidaTemplate({
    nombre,
    reservaId,
    detalles,
    total,
  });

  await enviarEmail({
    destinatario: email,
    asunto: contenido.subject,
    texto: contenido.text,
    html: contenido.html,
  });
};