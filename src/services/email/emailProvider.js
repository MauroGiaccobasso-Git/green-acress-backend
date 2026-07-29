import nodemailer from "nodemailer";
import { AppError } from "../../utils/appError.js";

/* =========================================================
   CONFIGURACIÓN SMTP
========================================================= */

const obtenerConfiguracionSmtp = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
    EMAIL_FROM_NAME,
    EMAIL_FROM_ADDRESS,
  } = process.env;

  if (
    !SMTP_HOST ||
    !SMTP_PORT ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !EMAIL_FROM_NAME ||
    !EMAIL_FROM_ADDRESS
  ) {
    throw new AppError("La configuración SMTP está incompleta", 500);
  }

  const puerto = Number(SMTP_PORT);

  if (!Number.isInteger(puerto) || puerto <= 0) {
    throw new AppError("El puerto SMTP configurado es inválido", 500);
  }

  return {
    host: SMTP_HOST,
    port: puerto,
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
    remitente: {
      nombre: EMAIL_FROM_NAME,
      direccion: EMAIL_FROM_ADDRESS,
    },
  };
};

/* =========================================================
   TRANSPORTER
========================================================= */

const crearTransporter = () => {
  const configuracion = obtenerConfiguracionSmtp();

  return nodemailer.createTransport({
    host: configuracion.host,
    port: configuracion.port,
    secure: configuracion.secure,
    auth: configuracion.auth,
  });
};

/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */

export const verificarConexionEmail = async () => {
  const transporter = crearTransporter();

  await transporter.verify();
};

export const enviarEmail = async ({ destinatario, asunto, texto, html }) => {
  if (!destinatario || !asunto || (!texto && !html)) {
    throw new AppError("Los datos del email son obligatorios", 400);
  }

  const configuracion = obtenerConfiguracionSmtp();
  const transporter = crearTransporter();

  const resultado = await transporter.sendMail({
    from: {
      name: configuracion.remitente.nombre,
      address: configuracion.remitente.direccion,
    },
    to: destinatario,
    subject: asunto,
    text: texto,
    html,
  });

  if (!Array.isArray(resultado.accepted) || resultado.accepted.length === 0) {
    throw new AppError("El servidor SMTP no aceptó ningún destinatario", 502);
  }

  return resultado;
};
