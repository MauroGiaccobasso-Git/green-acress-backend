import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

import prisma from "../../src/config/prisma.js";
import { registrarAuditoria } from "../../src/services/auditoriaService.js";
import { registrarCompra } from "../../src/services/compraService.js";
import { calcularConsumoMensualSocio } from "../../src/services/limiteLegalService.js";
import {
  actualizarEstadoProducto,
  crearProducto,
} from "../../src/services/productoService.js";
import {
  actualizarEstadoProveedor,
  crearProveedor,
} from "../../src/services/proveedorService.js";
import {
  cancelarReserva,
  confirmarRetiroReserva,
  solicitarReserva,
  vencerReservasExpiradas,
} from "../../src/services/reservaService.js";
import { cambiarEstadoSocio } from "../../src/services/socioService.js";
import { ajustarStock } from "../../src/services/stockService.js";
import {
  anularVenta,
  registrarVenta,
} from "../../src/services/ventaService.js";

/* =========================================================
   CONFIGURACIÓN Y PROTECCIONES
========================================================= */

const SEED_CONFIRMATION = "RESET_GREEN_ACRESS_DEMO";
const MONTEVIDEO_TIME_ZONE = "America/Montevideo";
const PASSWORD_ROUNDS = 10;
const FLOAT_TOLERANCE = 0.0001;

const readRequiredEnv = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta configurar la variable ${name}.`);
  }

  return value;
};

const validateStrongPassword = (password, variableName) => {
  const isStrong =
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!isStrong) {
    throw new Error(
      `${variableName} debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.`,
    );
  }
};

const getDatabaseName = async () => {
  const [result] = await prisma.$queryRaw`
    SELECT current_database() AS database_name
  `;

  return result?.database_name;
};

const assertSafeTargetDatabase = async () => {
  const confirmation = readRequiredEnv("DEMO_SEED_CONFIRM");
  const expectedDatabase = readRequiredEnv("DEMO_SEED_DATABASE");
  const actualDatabase = await getDatabaseName();

  if (confirmation !== SEED_CONFIRMATION) {
    throw new Error(
      `Confirmación inválida. DEMO_SEED_CONFIRM debe ser ${SEED_CONFIRMATION}.`,
    );
  }

  if (!actualDatabase || actualDatabase !== expectedDatabase) {
    throw new Error(
      `Base no autorizada. Esperada: ${expectedDatabase}. Actual: ${actualDatabase ?? "desconocida"}.`,
    );
  }

  const allowsNonDemoDatabase =
    process.env.DEMO_SEED_ALLOW_NON_DEMO_DATABASE === "true";

  if (
    !actualDatabase.toLowerCase().includes("demo") &&
    !allowsNonDemoDatabase
  ) {
    throw new Error(
      "La base autorizada no contiene 'demo' en su nombre. Para una excepción explícita use DEMO_SEED_ALLOW_NON_DEMO_DATABASE=true.",
    );
  }

  return actualDatabase;
};

const resetDatabase = async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "NotificacionEntrega",
      "Notificacion",
      "Novedad",
      "Auditoria",
      "HistorialReserva",
      "ReservaDetalle",
      "Reserva",
      "VentaDetalle",
      "Venta",
      "CompraDetalle",
      "Compra",
      "MovimientoStock",
      "Stock",
      "Producto",
      "Proveedor",
      "CodigoRecuperacionMfa",
      "RecuperacionPassword",
      "DesafioAutenticacion",
      "Socio",
      "Usuario"
    RESTART IDENTITY CASCADE;
  `);
};

/* =========================================================
   FECHAS DEMOSTRATIVAS
========================================================= */

const montevideoFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MONTEVIDEO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const getMontevideoParts = (date) => {
  return montevideoFormatter.formatToParts(date).reduce((parts, part) => {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }

    return parts;
  }, {});
};

const createUtcFromMontevideo = ({
  year,
  month,
  day,
  hour = 12,
  minute = 0,
  second = 0,
}) => {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let utcInstant = localAsUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const montevideoParts = getMontevideoParts(new Date(utcInstant));
    const montevideoAsUtc = Date.UTC(
      montevideoParts.year,
      montevideoParts.month - 1,
      montevideoParts.day,
      montevideoParts.hour,
      montevideoParts.minute,
      montevideoParts.second,
      0,
    );

    utcInstant += localAsUtc - montevideoAsUtc;
  }

  return new Date(utcInstant);
};

const getMonthContext = () => {
  const now = new Date();
  const current = getMontevideoParts(now);

  const previousMonth = current.month === 1 ? 12 : current.month - 1;
  const previousYear = current.month === 1 ? current.year - 1 : current.year;

  const dateInCurrentMonth = (preferredDay, hour = 12) =>
    createUtcFromMontevideo({
      year: current.year,
      month: current.month,
      day: Math.max(1, Math.min(preferredDay, current.day)),
      hour,
    });

  const dateInPreviousMonth = (day, hour = 12) =>
    createUtcFromMontevideo({
      year: previousYear,
      month: previousMonth,
      day,
      hour,
    });

  return {
    now,
    dateInCurrentMonth,
    dateInPreviousMonth,
  };
};

const addHours = (date, hours) =>
  new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);

const addDays = (date, days) => addHours(date, days * 24);

/* =========================================================
   DATOS BASE
========================================================= */

const PRODUCT_DEFINITIONS = [
  {
    key: "mobyDick",
    nombre: "Moby Dick",
    descripcion:
      "Flor híbrida de perfil cítrico, buena producción y alta rotación.",
    imagen_url:
      "https://green-acress-product-images-uy-2026.s3.us-east-1.amazonaws.com/productos/67afeb59-39dc-4d10-b5ce-083864550830.jpg",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 22,
    precio_venta_actual: 420,
    initialStock: 180,
    estado: "ACTIVO",
  },
  {
    key: "northernLights",
    nombre: "Northern Lights",
    descripcion: "Flor índica clásica, compacta y de aroma herbal suave.",
    imagen_url:
      "https://green-acress-product-images-uy-2026.s3.us-east-1.amazonaws.com/productos/a86d8986-cf7e-41e4-a1e4-9dd7bec6f4be.jpg",
    tipo: "FLOR",
    genetica: "INDICA",
    porcentaje_thc: 18,
    precio_venta_actual: 390,
    initialStock: 140,
    estado: "ACTIVO",
  },
  {
    key: "blueDream",
    nombre: "Blue Dream",
    descripcion:
      "Flor híbrida equilibrada, dulce y adecuada para el catálogo regular.",
    imagen_url:
      "https://green-acress-product-images-uy-2026.s3.us-east-1.amazonaws.com/productos/f8adc52e-8545-4840-b615-59eafd4b0775.jpg",
    tipo: "FLOR",
    genetica: "HIBRIDA",
    porcentaje_thc: 17,
    precio_venta_actual: 370,
    initialStock: 100,
    estado: "ACTIVO",
  },
  {
    key: "sourDiesel",
    nombre: "Sour Diesel",
    descripcion: "Flor sativa de aroma intenso y perfil energético.",
    imagen_url:
      "https://green-acress-product-images-uy-2026.s3.us-east-1.amazonaws.com/productos/5cf8144c-807e-498e-ab05-17749f51313d.jpg",
    tipo: "FLOR",
    genetica: "SATIVA",
    porcentaje_thc: 20,
    precio_venta_actual: 410,
    initialStock: 65,
    estado: "ACTIVO",
  },
  {
    key: "purplePunch",
    nombre: "Purple Punch",
    descripcion:
      "Flor índica de perfil dulce utilizada para demostrar stock crítico.",
    imagen_url:
      "https://green-acress-product-images-uy-2026.s3.us-east-1.amazonaws.com/productos/ae43fe3f-db5c-4d55-9098-6d1ee0766a8a.jpg",
    tipo: "FLOR",
    genetica: "INDICA",
    porcentaje_thc: 21,
    precio_venta_actual: 400,
    initialStock: 0,
    estado: "ACTIVO",
  },
  {
    key: "seedMobyDick",
    nombre: "Semilla Moby Dick",
    descripcion: "Semilla feminizada de genética híbrida.",
    imagen_url: null,
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    precio_venta_actual: null,
    estado: "ACTIVO",
  },
  {
    key: "seedNorthernLights",
    nombre: "Semilla Northern Lights",
    descripcion: "Semilla feminizada de genética índica.",
    imagen_url: null,
    tipo: "SEMILLA",
    genetica: "INDICA",
    porcentaje_thc: null,
    precio_venta_actual: null,
    estado: "ACTIVO",
  },
  {
    key: "seedBlueDream",
    nombre: "Semilla Blue Dream",
    descripcion:
      "Semilla híbrida fuera del catálogo activo, conservada para historial.",
    imagen_url: null,
    tipo: "SEMILLA",
    genetica: "HIBRIDA",
    porcentaje_thc: null,
    precio_venta_actual: null,
    estado: "INACTIVO",
  },
];

const PROVIDER_DEFINITIONS = [
  {
    key: "geneticaSur",
    nombre: "Genética Sur",
    contacto: "Mariana López",
    telefono: "099410101",
    email: "ventas@geneticasur.example.com",
    estado: "ACTIVO",
  },
  {
    key: "semillasDelPlata",
    nombre: "Semillas del Plata",
    contacto: "Rodrigo Núñez",
    telefono: "098420202",
    email: "contacto@semillasdelplata.example.com",
    estado: "ACTIVO",
  },
  {
    key: "cultivaUy",
    nombre: "Cultiva Uruguay",
    contacto: "Luciana Costa",
    telefono: "097430303",
    email: "pedidos@cultivauruguay.example.com",
    estado: "ACTIVO",
  },
  {
    key: "bancoOriental",
    nombre: "Banco Oriental de Semillas",
    contacto: "Santiago Vidal",
    telefono: "096440404",
    email: "comercial@bancooriental.example.com",
    estado: "ACTIVO",
  },
  {
    key: "viveroHistorico",
    nombre: "Vivero Histórico",
    contacto: "Daniela Pereyra",
    telefono: "095450505",
    email: "administracion@viverohistorico.example.com",
    estado: "INACTIVO",
  },
];

const MEMBER_DEFINITIONS = [
  {
    key: "demo",
    email: process.env.DEMO_SOCIO_EMAIL?.trim() || "socio.demo@greenacres.uy",
    documento: "47291835",
    nombre: "Valentina",
    apellido: "Rodríguez",
    telefono: "099111201",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "nearLimit",
    email: "martin.pereira@demo.greenacres.uy",
    documento: "51382746",
    nombre: "Martín",
    apellido: "Pereira",
    telefono: "099111202",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "lucia",
    email: "lucia.fernandez@demo.greenacres.uy",
    documento: "49625173",
    nombre: "Lucía",
    apellido: "Fernández",
    telefono: "099111203",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "nicolas",
    email: "nicolas.silva@demo.greenacres.uy",
    documento: "52840619",
    nombre: "Nicolás",
    apellido: "Silva",
    telefono: "099111204",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "camila",
    email: "camila.gonzalez@demo.greenacres.uy",
    documento: "48371620",
    nombre: "Camila",
    apellido: "González",
    telefono: "099111205",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "joaquin",
    email: "joaquin.martinez@demo.greenacres.uy",
    documento: "53619482",
    nombre: "Joaquín",
    apellido: "Martínez",
    telefono: "099111206",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "consentPending",
    email: "sofia.acosta@demo.greenacres.uy",
    documento: "46730591",
    nombre: "Sofía",
    apellido: "Acosta",
    telefono: "099111207",
    consentimiento_aceptado: false,
    finalState: "ACTIVO",
  },
  {
    key: "diego",
    email: "diego.cabrera@demo.greenacres.uy",
    documento: "50963814",
    nombre: "Diego",
    apellido: "Cabrera",
    telefono: "099111208",
    consentimiento_aceptado: true,
    finalState: "ACTIVO",
  },
  {
    key: "inactiveAna",
    email: "ana.torres@demo.greenacres.uy",
    documento: "45192786",
    nombre: "Ana",
    apellido: "Torres",
    telefono: "099111209",
    consentimiento_aceptado: true,
    finalState: "INACTIVO",
  },
  {
    key: "inactiveBruno",
    email: "bruno.mendez@demo.greenacres.uy",
    documento: "54281379",
    nombre: "Bruno",
    apellido: "Méndez",
    telefono: "099111210",
    consentimiento_aceptado: true,
    finalState: "INACTIVO",
  },
  {
    key: "suspendedPaula",
    email: "paula.ramos@demo.greenacres.uy",
    documento: "47836215",
    nombre: "Paula",
    apellido: "Ramos",
    telefono: "099111211",
    consentimiento_aceptado: true,
    finalState: "SUSPENDIDO",
  },
  {
    key: "suspendedFederico",
    email: "federico.lopez@demo.greenacres.uy",
    documento: "52097463",
    nombre: "Federico",
    apellido: "López",
    telefono: "099111212",
    consentimiento_aceptado: true,
    finalState: "SUSPENDIDO",
  },
];

/* =========================================================
   HELPERS DE CREACIÓN
========================================================= */

const createUsersAndMembers = async ({
  adminPassword,
  memberPassword,
  dates,
}) => {
  const adminEmail =
    process.env.DEMO_ADMIN_EMAIL?.trim() || "admin.demo@greenacres.uy";
  const systemEmail =
    process.env.SYSTEM_USER_EMAIL?.trim() || "system@greenacres.local";
  const mainMemberEmail = MEMBER_DEFINITIONS[0].email;

  if (new Set([adminEmail, systemEmail, mainMemberEmail]).size !== 3) {
    throw new Error(
      "DEMO_ADMIN_EMAIL, DEMO_SOCIO_EMAIL y SYSTEM_USER_EMAIL deben ser diferentes.",
    );
  }

  const [adminPasswordHash, memberPasswordHash, systemPasswordHash] =
    await Promise.all([
      bcrypt.hash(adminPassword, PASSWORD_ROUNDS),
      bcrypt.hash(memberPassword, PASSWORD_ROUNDS),
      bcrypt.hash(randomBytes(48).toString("hex"), PASSWORD_ROUNDS),
    ]);

  const admin = await prisma.usuario.create({
    data: {
      email: adminEmail,
      password_hash: adminPasswordHash,
      rol: "ADMIN",
      estado: "ACTIVO",
      requiere_cambio_password: false,
      mfa_habilitado: false,
      fecha_creacion: dates.dateInPreviousMonth(2, 10),
    },
  });

  const operationsAdmin = await prisma.usuario.create({
    data: {
      email: "operaciones.demo@greenacres.uy",
      password_hash: adminPasswordHash,
      rol: "ADMIN",
      estado: "ACTIVO",
      requiere_cambio_password: false,
      mfa_habilitado: false,
      fecha_creacion: dates.dateInPreviousMonth(3, 10),
    },
  });

  await prisma.usuario.create({
    data: {
      email: systemEmail,
      password_hash: systemPasswordHash,
      rol: "ADMIN",
      estado: "INACTIVO",
      requiere_cambio_password: false,
      mfa_habilitado: false,
      fecha_creacion: dates.dateInPreviousMonth(1, 9),
    },
  });

  const members = {};

  for (const [index, definition] of MEMBER_DEFINITIONS.entries()) {
    const memberCreationDay = 2 + Math.floor(index / 4);
    const memberCreationDate = dates.dateInPreviousMonth(
      memberCreationDay,
      10 + (index % 4),
    );
    const consentDate = definition.consentimiento_aceptado
      ? addHours(memberCreationDate, 1)
      : null;

    const user = await prisma.usuario.create({
      data: {
        email: definition.email,
        password_hash: memberPasswordHash,
        rol: "SOCIO",
        estado: "ACTIVO",
        requiere_cambio_password: false,
        mfa_habilitado: false,
        fecha_creacion: memberCreationDate,
        socio: {
          create: {
            documento: definition.documento,
            nombre: definition.nombre,
            apellido: definition.apellido,
            telefono: definition.telefono,
            estado: "ACTIVO",
            fecha_alta: memberCreationDate,
            fecha_creacion: memberCreationDate,
            consentimiento_aceptado: definition.consentimiento_aceptado,
            fecha_consentimiento: consentDate,
          },
        },
      },
      include: {
        socio: true,
      },
    });

    members[definition.key] = user;

    const memberAudit = await registrarAuditoria({
      usuarioId: admin.id,
      accion: "CREAR_SOCIO",
      entidad: "Socio",
      entidadId: user.socio.id,
      detalle: `Socio demo ${definition.nombre} ${definition.apellido} creado para el entorno de demostración.`,
    });

    await prisma.auditoria.update({
      where: { id: memberAudit.id },
      data: { fecha_creacion: user.socio.fecha_alta },
    });
  }

  return {
    admin,
    operationsAdmin,
    members,
    credentials: {
      adminEmail,
      memberEmail: MEMBER_DEFINITIONS[0].email,
    },
  };
};

const createProducts = async ({ adminId, dates }) => {
  const products = {};
  const baseDate = dates.dateInPreviousMonth(4, 8);

  for (const [index, definition] of PRODUCT_DEFINITIONS.entries()) {
    const creationDate = addHours(baseDate, index);
    const product = await crearProducto({
      usuarioId: adminId,
      datosProducto: {
        nombre: definition.nombre,
        descripcion: definition.descripcion,
        imagen_url: definition.imagen_url,
        tipo: definition.tipo,
        genetica: definition.genetica,
        porcentaje_thc: definition.porcentaje_thc,
        precio_venta_actual: definition.precio_venta_actual,
      },
    });

    if (definition.estado === "INACTIVO") {
      await actualizarEstadoProducto({
        productoId: product.id,
        nuevoEstado: "INACTIVO",
        usuarioId: adminId,
      });
    }

    const productAudits = await prisma.auditoria.findMany({
      where: {
        entidad: "Producto",
        entidad_id: product.id,
      },
      select: {
        id: true,
        accion: true,
      },
    });

    for (const audit of productAudits) {
      await prisma.auditoria.update({
        where: { id: audit.id },
        data: {
          fecha_creacion:
            audit.accion === "CREAR_PRODUCTO"
              ? creationDate
              : addHours(creationDate, 1),
        },
      });
    }

    await prisma.producto.update({
      where: { id: product.id },
      data: {
        fecha_creacion: creationDate,
        fecha_actualizacion:
          definition.estado === "INACTIVO"
            ? addHours(creationDate, 1)
            : creationDate,
      },
    });

    products[definition.key] = product;
  }

  return products;
};

const createProviders = async ({ adminId, dates }) => {
  const providers = {};
  const baseDate = dates.dateInPreviousMonth(4, 9);

  for (const [index, definition] of PROVIDER_DEFINITIONS.entries()) {
    const creationDate = addHours(baseDate, index);
    const provider = await crearProveedor({
      usuarioId: adminId,
      datosProveedor: {
        nombre: definition.nombre,
        contacto: definition.contacto,
        telefono: definition.telefono,
        email: definition.email,
      },
    });

    await prisma.proveedor.update({
      where: { id: provider.id },
      data: {
        fecha_creacion: creationDate,
        fecha_actualizacion: creationDate,
      },
    });

    await prisma.auditoria.updateMany({
      where: {
        entidad: "Proveedor",
        entidad_id: provider.id,
        accion: "CREAR_PROVEEDOR",
      },
      data: { fecha_creacion: creationDate },
    });

    providers[definition.key] = provider;
  }

  return providers;
};

const createInitialFlowerStock = async ({ adminId, products, dates }) => {
  let batchNumber = 1;
  const baseDate = dates.dateInPreviousMonth(5, 8);

  for (const definition of PRODUCT_DEFINITIONS.filter(
    (product) => product.tipo === "FLOR",
  )) {
    // Un producto activo sin stock se conserva en cero para demostrar
    // alertas de agotado y rechazos automáticos por falta de inventario.
    if (definition.initialStock === 0) {
      continue;
    }

    const movementDate = addHours(baseDate, batchNumber - 1);

    await ajustarStock({
      productoId: products[definition.key].id,
      usuarioId: adminId,
      variacion: definition.initialStock,
      referenciaTipo: "PRODUCCION_DEMO",
      referenciaId: batchNumber,
      observaciones:
        "Ingreso inicial de producción interna para el entorno demostrativo.",
    });

    await prisma.movimientoStock.updateMany({
      where: {
        referencia_tipo: "PRODUCCION_DEMO",
        referencia_id: batchNumber,
      },
      data: { fecha_creacion: movementDate },
    });

    await prisma.auditoria.updateMany({
      where: {
        entidad: "Stock",
        entidad_id: products[definition.key].id,
        accion: "AJUSTAR_STOCK",
      },
      data: { fecha_creacion: movementDate },
    });

    batchNumber += 1;
  }
};

const backdatePurchase = async (purchaseId, date) => {
  await prisma.$transaction([
    prisma.compra.update({
      where: { id: purchaseId },
      data: {
        fecha: date,
        fecha_creacion: date,
        fecha_actualizacion: date,
      },
    }),
    prisma.movimientoStock.updateMany({
      where: {
        referencia_tipo: "COMPRA",
        referencia_id: purchaseId,
      },
      data: { fecha_creacion: date },
    }),
    prisma.auditoria.updateMany({
      where: {
        entidad: "Compra",
        entidad_id: purchaseId,
      },
      data: { fecha_creacion: date },
    }),
  ]);
};

const createPurchases = async ({ adminId, products, providers, dates }) => {
  const definitions = [
    {
      provider: "geneticaSur",
      date: dates.dateInPreviousMonth(5),
      observation: "Reposición mensual de semillas híbridas.",
      details: [
        ["seedMobyDick", 20, 135],
        ["seedBlueDream", 10, 128],
      ],
    },
    {
      provider: "semillasDelPlata",
      date: dates.dateInPreviousMonth(8),
      observation: "Ingreso planificado de semillas índicas.",
      details: [["seedNorthernLights", 18, 122]],
    },
    {
      provider: "cultivaUy",
      date: dates.dateInPreviousMonth(13),
      observation: "Compra de refuerzo para banco genético.",
      details: [
        ["seedMobyDick", 12, 138],
        ["seedNorthernLights", 8, 125],
      ],
    },
    {
      provider: "viveroHistorico",
      date: dates.dateInPreviousMonth(19),
      observation: "Última compra previa a la inactivación del proveedor.",
      details: [["seedBlueDream", 6, 130]],
    },
    {
      provider: "bancoOriental",
      date: dates.dateInCurrentMonth(1),
      observation: "Reposición de inicio de mes.",
      details: [["seedMobyDick", 10, 142]],
    },
    {
      provider: "geneticaSur",
      date: dates.dateInCurrentMonth(2),
      observation: "Compra complementaria por demanda proyectada.",
      details: [["seedNorthernLights", 10, 126]],
    },
    {
      provider: "semillasDelPlata",
      date: dates.dateInCurrentMonth(3),
      observation: "Ingreso de lote pequeño para trazabilidad.",
      details: [["seedBlueDream", 5, 132]],
    },
    {
      provider: "cultivaUy",
      date: dates.dateInCurrentMonth(4),
      observation: "Reposición combinada de semillas activas.",
      details: [
        ["seedMobyDick", 8, 145],
        ["seedNorthernLights", 6, 129],
      ],
    },
  ];

  const purchases = [];

  for (const definition of definitions) {
    const purchase = await registrarCompra(
      {
        proveedor_id: providers[definition.provider].id,
        observaciones: definition.observation,
        detalles: definition.details.map(
          ([productKey, quantity, unitPrice]) => ({
            producto_id: products[productKey].id,
            cantidad: quantity,
            precio_unitario: unitPrice,
          }),
        ),
      },
      adminId,
    );

    await backdatePurchase(purchase.id, definition.date);
    purchases.push(purchase);
  }

  return purchases;
};

const backdateSale = async (saleId, date) => {
  const sale = await prisma.venta.findUnique({
    where: { id: saleId },
    select: { estado: true },
  });

  if (!sale) {
    throw new Error(`No existe la venta #${saleId} para ajustar fechas.`);
  }

  const annulmentDate = addHours(date, 2);
  const updateDate = sale.estado === "ANULADA" ? annulmentDate : date;

  await prisma.venta.update({
    where: { id: saleId },
    data: {
      fecha: date,
      fecha_creacion: date,
      fecha_actualizacion: updateDate,
    },
  });

  const movements = await prisma.movimientoStock.findMany({
    where: {
      referencia_id: saleId,
      referencia_tipo: {
        in: ["VENTA", "ANULACION_VENTA"],
      },
    },
    select: {
      id: true,
      referencia_tipo: true,
    },
  });

  for (const movement of movements) {
    await prisma.movimientoStock.update({
      where: { id: movement.id },
      data: {
        fecha_creacion:
          movement.referencia_tipo === "ANULACION_VENTA" ? annulmentDate : date,
      },
    });
  }

  const audits = await prisma.auditoria.findMany({
    where: {
      entidad: "Venta",
      entidad_id: saleId,
    },
    select: {
      id: true,
      accion: true,
    },
  });

  for (const audit of audits) {
    await prisma.auditoria.update({
      where: { id: audit.id },
      data: {
        fecha_creacion: audit.accion === "ANULAR_VENTA" ? annulmentDate : date,
      },
    });
  }
};

const createSale = async ({
  adminId,
  member,
  products,
  date,
  details,
  observations,
  annul = false,
}) => {
  const sale = await registrarVenta({
    socioId: member.socio.id,
    usuarioId: adminId,
    detalles: details.map(([productKey, quantity]) => ({
      producto_id: products[productKey].id,
      cantidad: quantity,
    })),
    observaciones: observations,
  });

  if (annul) {
    await anularVenta({
      ventaId: sale.id,
      usuarioId: adminId,
    });
  }

  await backdateSale(sale.id, date);

  return prisma.venta.findUnique({
    where: { id: sale.id },
    include: { detalles: true },
  });
};

const createDirectSales = async ({ adminId, members, products, dates }) => {
  const definitions = [
    {
      member: "demo",
      date: dates.dateInPreviousMonth(6),
      details: [["mobyDick", 8]],
      observations: "Retiro presencial correspondiente al mes anterior.",
    },
    {
      member: "nearLimit",
      date: dates.dateInPreviousMonth(9),
      details: [["northernLights", 12]],
      observations: "Venta histórica para comparación del dashboard.",
    },
    {
      member: "lucia",
      date: dates.dateInPreviousMonth(14),
      details: [["blueDream", 6]],
      observations: "Retiro regular registrado el mes anterior.",
    },
    {
      member: "inactiveAna",
      date: dates.dateInPreviousMonth(18),
      details: [["sourDiesel", 5]],
      observations: "Venta previa a la inactivación del socio.",
    },
    {
      member: "nearLimit",
      date: dates.dateInCurrentMonth(1),
      details: [["mobyDick", 20]],
      observations: "Primer retiro del socio durante el mes actual.",
    },
    {
      member: "nearLimit",
      date: dates.dateInCurrentMonth(3),
      details: [["northernLights", 15]],
      observations: "Segundo retiro; consumo mensual acumulado en 35 g.",
    },
    {
      member: "demo",
      date: dates.dateInCurrentMonth(2),
      details: [["blueDream", 4]],
      observations: "Venta de demostración del mes actual.",
    },
    {
      member: "diego",
      date: dates.dateInCurrentMonth(4),
      details: [["sourDiesel", 9]],
      observations: "Retiro presencial registrado por administración.",
    },
    {
      member: "lucia",
      date: dates.dateInCurrentMonth(3),
      details: [["northernLights", 5]],
      observations: "Venta anulada por error de carga.",
      annul: true,
    },
    {
      member: "nicolas",
      date: dates.dateInCurrentMonth(4),
      details: [["blueDream", 3]],
      observations: "Venta anulada por corrección administrativa.",
      annul: true,
    },
  ];

  const sales = [];

  for (const definition of definitions) {
    sales.push(
      await createSale({
        adminId,
        member: members[definition.member],
        products,
        date: definition.date,
        details: definition.details,
        observations: definition.observations,
        annul: definition.annul,
      }),
    );
  }

  return sales;
};

const withExternalEmailDisabled = async (operation) => {
  const smtpKeys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "EMAIL_FROM_NAME",
    "EMAIL_FROM_ADDRESS",
  ];

  const previousValues = Object.fromEntries(
    smtpKeys.map((key) => [key, process.env[key]]),
  );

  const originalConsoleError = console.error;

  try {
    for (const key of smtpKeys) {
      process.env[key] = "";
    }

    console.error = (...args) => {
      const firstArgument = String(args[0] ?? "");

      if (firstArgument.startsWith("[NOTIFICACION]")) {
        return;
      }

      originalConsoleError(...args);
    };

    return await operation();
  } finally {
    console.error = originalConsoleError;

    for (const key of smtpKeys) {
      if (previousValues[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValues[key];
      }
    }
  }
};

const backdateReservation = async ({
  reservationId,
  requestDate,
  deadline = undefined,
  saleDate = null,
}) => {
  const reservation = await prisma.reserva.findUnique({
    where: { id: reservationId },
    select: {
      estado: true,
      venta_id: true,
    },
  });

  if (!reservation) {
    throw new Error(
      `No existe la reserva #${reservationId} para ajustar fechas.`,
    );
  }

  const effectiveDeadline =
    deadline === undefined
      ? undefined
      : deadline === null
        ? null
        : new Date(deadline);

  const confirmationDate = addHours(requestDate, 1);
  const finalEventDate = (() => {
    if (reservation.estado === "FINALIZADA") {
      return saleDate ?? addDays(requestDate, 1);
    }

    if (reservation.estado === "VENCIDA") {
      return effectiveDeadline
        ? addHours(effectiveDeadline, 1)
        : addDays(requestDate, 4);
    }

    if (reservation.estado === "CANCELADA") {
      return addHours(requestDate, 6);
    }

    if (reservation.estado === "RECHAZADA") {
      return confirmationDate;
    }

    return confirmationDate;
  })();

  const reservationData = {
    fecha_solicitud: requestDate,
    fecha_actualizacion: finalEventDate,
  };

  if (deadline !== undefined) {
    reservationData.fecha_limite_retiro = effectiveDeadline;
  }

  await prisma.reserva.update({
    where: { id: reservationId },
    data: reservationData,
  });

  const history = await prisma.historialReserva.findMany({
    where: { reserva_id: reservationId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      estado: true,
    },
  });

  for (const item of history) {
    const historyDate = (() => {
      if (item.estado === "PENDIENTE") {
        return requestDate;
      }

      if (item.estado === "CONFIRMADA" || item.estado === "RECHAZADA") {
        return confirmationDate;
      }

      return finalEventDate;
    })();

    await prisma.historialReserva.update({
      where: { id: item.id },
      data: { fecha: historyDate },
    });
  }

  const audits = await prisma.auditoria.findMany({
    where: {
      entidad: "Reserva",
      entidad_id: reservationId,
    },
    select: {
      id: true,
      accion: true,
    },
  });

  for (const audit of audits) {
    const auditDate =
      audit.accion === "SOLICITAR_RESERVA"
        ? requestDate
        : audit.accion === "CONFIRMAR_RESERVA" ||
            audit.accion === "RECHAZAR_RESERVA"
          ? confirmationDate
          : finalEventDate;

    await prisma.auditoria.update({
      where: { id: audit.id },
      data: { fecha_creacion: auditDate },
    });
  }

  const movements = await prisma.movimientoStock.findMany({
    where: {
      referencia_tipo: "RESERVA",
      referencia_id: reservationId,
    },
    select: {
      id: true,
      tipo: true,
    },
  });

  for (const movement of movements) {
    const movementDate =
      movement.tipo === "RESERVA" ? confirmationDate : finalEventDate;

    await prisma.movimientoStock.update({
      where: { id: movement.id },
      data: { fecha_creacion: movementDate },
    });
  }

  if (reservation.venta_id && saleDate) {
    await backdateSale(reservation.venta_id, saleDate);
  }
};

const requestReservation = async ({
  member,
  products,
  details,
  observations,
}) => {
  const result = await withExternalEmailDisabled(() =>
    solicitarReserva({
      usuarioId: member.id,
      observaciones: observations,
      detalles: details.map(([productKey, quantity]) => ({
        producto_id: products[productKey].id,
        cantidad: quantity,
      })),
    }),
  );

  return prisma.reserva.findUnique({
    where: { id: result.id },
    include: {
      detalles: true,
      historial: true,
    },
  });
};

const createReservationScenarios = async ({
  adminId,
  members,
  products,
  dates,
}) => {
  const reservations = {};

  reservations.finalizedDemo = await requestReservation({
    member: members.demo,
    products,
    details: [["mobyDick", 7]],
    observations: "Reserva retirada correctamente por el socio demo.",
  });

  await confirmarRetiroReserva({
    reservaId: reservations.finalizedDemo.id,
    usuarioId: adminId,
    observaciones: "Retiro presencial verificado por administración.",
  });

  await backdateReservation({
    reservationId: reservations.finalizedDemo.id,
    requestDate: dates.dateInCurrentMonth(2, 9),
    deadline: addDays(dates.dateInCurrentMonth(2, 9), 4),
    saleDate: dates.dateInCurrentMonth(3, 16),
  });

  reservations.finalizedCamila = await requestReservation({
    member: members.camila,
    products,
    details: [["northernLights", 10]],
    observations: "Reserva convertida en venta luego del retiro.",
  });

  await confirmarRetiroReserva({
    reservaId: reservations.finalizedCamila.id,
    usuarioId: adminId,
    observaciones: "Retiro confirmado sin observaciones.",
  });

  await backdateReservation({
    reservationId: reservations.finalizedCamila.id,
    requestDate: dates.dateInCurrentMonth(1, 10),
    deadline: addDays(dates.dateInCurrentMonth(1, 10), 4),
    saleDate: dates.dateInCurrentMonth(2, 17),
  });

  reservations.finalizedPaula = await requestReservation({
    member: members.suspendedPaula,
    products,
    details: [["blueDream", 6]],
    observations: "Reserva histórica previa a la suspensión del socio.",
  });

  await confirmarRetiroReserva({
    reservaId: reservations.finalizedPaula.id,
    usuarioId: adminId,
    observaciones: "Retiro histórico confirmado.",
  });

  await backdateReservation({
    reservationId: reservations.finalizedPaula.id,
    requestDate: dates.dateInPreviousMonth(10, 9),
    deadline: addDays(dates.dateInPreviousMonth(10, 9), 4),
    saleDate: dates.dateInPreviousMonth(12, 16),
  });

  reservations.confirmedDemo = await requestReservation({
    member: members.demo,
    products,
    details: [["mobyDick", 5]],
    observations: "Reserva activa próxima a vencer para demostración.",
  });

  await backdateReservation({
    reservationId: reservations.confirmedDemo.id,
    requestDate: dates.dateInCurrentMonth(4, 9),
    deadline: addHours(dates.now, 24),
  });

  reservations.confirmedLucia = await requestReservation({
    member: members.lucia,
    products,
    details: [["blueDream", 8]],
    observations: "Reserva confirmada con stock bloqueado.",
  });

  await backdateReservation({
    reservationId: reservations.confirmedLucia.id,
    requestDate: dates.dateInCurrentMonth(4, 11),
    deadline: addHours(dates.now, 48),
  });

  reservations.confirmedDiego = await requestReservation({
    member: members.diego,
    products,
    details: [["sourDiesel", 6]],
    observations: "Reserva activa dentro del plazo normal de retiro.",
  });

  await backdateReservation({
    reservationId: reservations.confirmedDiego.id,
    requestDate: dates.dateInCurrentMonth(3, 12),
    deadline: addDays(dates.now, 4),
  });

  reservations.cancelledNicolas = await requestReservation({
    member: members.nicolas,
    products,
    details: [["northernLights", 7]],
    observations: "Reserva que será cancelada por solicitud del socio.",
  });

  await withExternalEmailDisabled(() =>
    cancelarReserva({
      reservaId: reservations.cancelledNicolas.id,
      usuarioId: adminId,
      observaciones: "El socio informó que no podría concurrir al retiro.",
    }),
  );

  await backdateReservation({
    reservationId: reservations.cancelledNicolas.id,
    requestDate: dates.dateInCurrentMonth(1, 13),
    deadline: null,
  });

  reservations.cancelledCamila = await requestReservation({
    member: members.camila,
    products,
    details: [["mobyDick", 5]],
    observations: "Reserva cancelada por cambio en la preferencia del socio.",
  });

  await withExternalEmailDisabled(() =>
    cancelarReserva({
      reservaId: reservations.cancelledCamila.id,
      usuarioId: adminId,
      observaciones: "Cancelación administrativa solicitada por el socio.",
    }),
  );

  await backdateReservation({
    reservationId: reservations.cancelledCamila.id,
    requestDate: dates.dateInPreviousMonth(21, 14),
    deadline: null,
  });

  reservations.expiredAna = await requestReservation({
    member: members.inactiveAna,
    products,
    details: [["blueDream", 6]],
    observations: "Reserva no retirada dentro del plazo definido.",
  });

  reservations.expiredBruno = await requestReservation({
    member: members.inactiveBruno,
    products,
    details: [["sourDiesel", 4]],
    observations: "Segunda reserva vencida para historial.",
  });

  const expiredDeadline = addDays(dates.now, -2);

  await prisma.reserva.updateMany({
    where: {
      id: {
        in: [reservations.expiredAna.id, reservations.expiredBruno.id],
      },
    },
    data: {
      fecha_limite_retiro: expiredDeadline,
    },
  });

  await withExternalEmailDisabled(() => vencerReservasExpiradas());

  await backdateReservation({
    reservationId: reservations.expiredAna.id,
    requestDate: addDays(expiredDeadline, -5),
    deadline: expiredDeadline,
  });

  await backdateReservation({
    reservationId: reservations.expiredBruno.id,
    requestDate: addDays(expiredDeadline, -4),
    deadline: expiredDeadline,
  });

  reservations.rejectedLegalLimit = await requestReservation({
    member: members.nearLimit,
    products,
    details: [["mobyDick", 8]],
    observations: "Solicitud diseñada para demostrar el límite legal mensual.",
  });

  await backdateReservation({
    reservationId: reservations.rejectedLegalLimit.id,
    requestDate: dates.dateInCurrentMonth(4, 15),
    deadline: null,
  });

  reservations.rejectedStock = await requestReservation({
    member: members.joaquin,
    products,
    details: [["purplePunch", 6]],
    observations: "Solicitud diseñada para demostrar rechazo por stock.",
  });

  await backdateReservation({
    reservationId: reservations.rejectedStock.id,
    requestDate: dates.dateInCurrentMonth(4, 16),
    deadline: null,
  });

  return reservations;
};

const applyFinalMemberStates = async ({ adminId, members }) => {
  const stateChanges = [
    {
      member: "inactiveAna",
      state: "INACTIVO",
      reason: "Socio inactivo por decisión administrativa en el entorno demo.",
    },
    {
      member: "inactiveBruno",
      state: "INACTIVO",
      reason: "Socio sin actividad reciente; estado utilizado para filtros.",
    },
    {
      member: "suspendedPaula",
      state: "SUSPENDIDO",
      reason:
        "Suspensión demostrativa por incumplimiento del reglamento interno.",
    },
    {
      member: "suspendedFederico",
      state: "SUSPENDIDO",
      reason: "Suspensión demostrativa para validar restricción de acceso.",
    },
  ];

  for (const change of stateChanges) {
    await cambiarEstadoSocio({
      socioId: members[change.member].socio.id,
      usuarioId: adminId,
      nuevoEstado: change.state,
      motivo: change.reason,
    });
  }
};

const deactivateHistoricalProvider = async ({ adminId, providers, dates }) => {
  const deactivationDate = dates.dateInPreviousMonth(25, 16);

  await actualizarEstadoProveedor({
    proveedorId: providers.viveroHistorico.id,
    nuevoEstado: "INACTIVO",
    usuarioId: adminId,
  });

  await prisma.proveedor.update({
    where: { id: providers.viveroHistorico.id },
    data: { fecha_actualizacion: deactivationDate },
  });

  await prisma.auditoria.updateMany({
    where: {
      entidad: "Proveedor",
      entidad_id: providers.viveroHistorico.id,
      accion: "CAMBIAR_ESTADO_PROVEEDOR",
    },
    data: { fecha_creacion: deactivationDate },
  });
};

const createNews = async ({ adminId, dates }) => {
  const definitions = [
    {
      titulo: "Nuevo horario de atención para retiros",
      contenido:
        "A partir de este mes, los retiros presenciales se coordinan de lunes a viernes entre las 16:00 y las 20:00 horas.",
      estado: "ACTIVA",
      fecha: dates.dateInCurrentMonth(1, 9),
    },
    {
      titulo: "Ingreso de nuevas genéticas al catálogo",
      contenido:
        "Se incorporaron nuevas opciones de flores y semillas. Consultá disponibilidad y características desde el portal.",
      estado: "ACTIVA",
      fecha: dates.dateInCurrentMonth(2, 10),
    },
    {
      titulo: "Recordatorio sobre el límite mensual",
      contenido:
        "El sistema controla automáticamente el máximo legal de 40 gramos por socio y por mes calendario.",
      estado: "ACTIVA",
      fecha: dates.dateInCurrentMonth(3, 11),
    },
    {
      titulo: "Mantenimiento programado del club",
      contenido:
        "El próximo sábado se realizarán tareas de mantenimiento. Las reservas confirmadas conservarán su plazo vigente.",
      estado: "ACTIVA",
      fecha: dates.dateInCurrentMonth(4, 12),
    },
    {
      titulo: "Convocatoria a jornada informativa",
      contenido:
        "La jornada informativa del mes anterior finalizó correctamente y queda archivada como antecedente.",
      estado: "INACTIVA",
      fecha: dates.dateInPreviousMonth(12, 12),
    },
    {
      titulo: "Actualización anterior del reglamento interno",
      contenido:
        "Versión histórica de una comunicación institucional actualmente fuera de publicación.",
      estado: "INACTIVA",
      fecha: dates.dateInPreviousMonth(20, 12),
    },
  ];

  const news = [];

  for (const definition of definitions) {
    const item = await prisma.novedad.create({
      data: {
        titulo: definition.titulo,
        contenido: definition.contenido,
        estado: definition.estado,
        usuario_id: adminId,
        fecha_creacion: definition.fecha,
        fecha_actualizacion: definition.fecha,
      },
    });

    await registrarAuditoria({
      usuarioId: adminId,
      accion: "CREAR_NOVEDAD",
      entidad: "Novedad",
      entidadId: item.id,
      detalle: `Novedad demo "${item.titulo}" creada en estado ${item.estado}.`,
    });

    await prisma.auditoria.updateMany({
      where: {
        entidad: "Novedad",
        entidad_id: item.id,
      },
      data: { fecha_creacion: definition.fecha },
    });

    news.push(item);
  }

  return news;
};

const createNotification = async ({
  member,
  newsItem = null,
  type,
  message,
  status,
  originType,
  originId,
  date,
}) => {
  const notification = await prisma.notificacion.create({
    data: {
      socio_id: member.socio.id,
      novedad_id: newsItem?.id ?? null,
      tipo: type,
      mensaje: message,
      estado: status,
      origen_tipo: originType,
      origen_id: originId,
      fecha_creacion: date,
    },
  });

  const deliveryData = {
    notificacion_id: notification.id,
    canal: "EMAIL",
    estado: status,
    intentos: status === "PENDIENTE" ? 0 : status === "ENVIADA" ? 1 : 3,
    fecha_creacion: date,
  };

  if (status === "ENVIADA") {
    deliveryData.fecha_ultimo_intento = addHours(date, 1);
    deliveryData.fecha_envio = addHours(date, 1);
  }

  if (status === "ERROR") {
    deliveryData.fecha_ultimo_intento = addHours(date, 1);
    deliveryData.error_detalle =
      "No fue posible completar la entrega en el entorno demostrativo.";
  }

  await prisma.notificacionEntrega.create({
    data: deliveryData,
  });

  return notification;
};

const createNotifications = async ({ members, news, reservations, dates }) => {
  // Los servicios de reservas generan notificaciones reales durante el flujo.
  // Para que el entorno final tenga un conjunto pequeño y controlado de estados,
  // se reemplazan por 12 registros demostrativos coherentes.
  await prisma.notificacionEntrega.deleteMany();
  await prisma.notificacion.deleteMany();

  const definitions = [
    {
      member: "demo",
      newsIndex: 0,
      type: "NOVEDAD_PUBLICADA",
      status: "ENVIADA",
      message: "Nuevo horario de atención disponible en el portal.",
      date: dates.dateInCurrentMonth(1, 10),
    },
    {
      member: "lucia",
      newsIndex: 1,
      type: "NOVEDAD_PUBLICADA",
      status: "ENVIADA",
      message: "Se publicaron nuevas genéticas en el catálogo.",
      date: dates.dateInCurrentMonth(2, 11),
    },
    {
      member: "camila",
      newsIndex: 2,
      type: "NOVEDAD_PUBLICADA",
      status: "PENDIENTE",
      message: "Recordatorio disponible sobre el límite mensual.",
      date: dates.dateInCurrentMonth(3, 12),
    },
    {
      member: "diego",
      newsIndex: 3,
      type: "NOVEDAD_PUBLICADA",
      status: "ERROR",
      message: "Aviso de mantenimiento programado del club.",
      date: dates.dateInCurrentMonth(4, 13),
    },
    {
      member: "joaquin",
      newsIndex: 0,
      type: "NOVEDAD_PUBLICADA",
      status: "PENDIENTE",
      message: "Comunicación institucional pendiente de entrega.",
      date: dates.dateInCurrentMonth(4, 14),
    },
    {
      member: "nearLimit",
      newsIndex: 1,
      type: "NOVEDAD_PUBLICADA",
      status: "ENVIADA",
      message: "Actualización del catálogo entregada correctamente.",
      date: dates.dateInCurrentMonth(3, 15),
    },
    {
      member: "demo",
      reservation: "confirmedDemo",
      type: "RESERVA_CONFIRMADA",
      status: "ENVIADA",
      message: `La reserva #${reservations.confirmedDemo.id} fue confirmada correctamente.`,
      date: dates.dateInCurrentMonth(4, 15),
    },
    {
      member: "lucia",
      reservation: "confirmedLucia",
      type: "RESERVA_CONFIRMADA",
      status: "PENDIENTE",
      message: `La reserva #${reservations.confirmedLucia.id} está confirmada y pendiente de retiro.`,
      date: dates.dateInCurrentMonth(4, 16),
    },
    {
      member: "nicolas",
      reservation: "cancelledNicolas",
      type: "RESERVA_CANCELADA",
      status: "ENVIADA",
      message: `La reserva #${reservations.cancelledNicolas.id} fue cancelada.`,
      date: dates.dateInCurrentMonth(2, 16),
    },
    {
      member: "inactiveAna",
      reservation: "expiredAna",
      type: "RESERVA_VENCIDA",
      status: "ERROR",
      message: `La reserva #${reservations.expiredAna.id} venció y liberó su stock.`,
      date: addDays(dates.now, -1),
    },
    {
      member: "nearLimit",
      reservation: "rejectedLegalLimit",
      type: "RESERVA_RECHAZADA",
      status: "ENVIADA",
      message: `La reserva #${reservations.rejectedLegalLimit.id} fue rechazada por superar el límite mensual.`,
      date: dates.dateInCurrentMonth(4, 17),
    },
    {
      member: "joaquin",
      reservation: "rejectedStock",
      type: "RESERVA_RECHAZADA",
      status: "ERROR",
      message: `La reserva #${reservations.rejectedStock.id} fue rechazada por stock insuficiente.`,
      date: dates.dateInCurrentMonth(4, 18),
    },
  ];

  for (const definition of definitions) {
    const reservation = definition.reservation
      ? reservations[definition.reservation]
      : null;
    const newsItem = Number.isInteger(definition.newsIndex)
      ? news[definition.newsIndex]
      : null;

    await createNotification({
      member: members[definition.member],
      newsItem,
      type: definition.type,
      message: definition.message,
      status: definition.status,
      originType: reservation ? "RESERVA" : "NOVEDAD",
      originId: reservation?.id ?? newsItem.id,
      date: definition.date,
    });
  }
};

/* =========================================================
   VALIDACIÓN FINAL
========================================================= */

const assertCondition = (condition, message) => {
  if (!condition) {
    throw new Error(`Validación del seed: ${message}`);
  }
};

const approximatelyEqual = (left, right) =>
  Math.abs(Number(left) - Number(right)) <= FLOAT_TOLERANCE;

const validateStockIntegrity = async () => {
  const stocks = await prisma.stock.findMany({
    include: { producto: true },
  });

  for (const stock of stocks) {
    assertCondition(
      stock.cantidad_total >= 0,
      `${stock.producto.nombre} tiene stock total negativo.`,
    );
    assertCondition(
      stock.cantidad_reservada >= 0,
      `${stock.producto.nombre} tiene stock reservado negativo.`,
    );
    assertCondition(
      stock.cantidad_disponible >= 0,
      `${stock.producto.nombre} tiene stock disponible negativo.`,
    );
    assertCondition(
      approximatelyEqual(
        stock.cantidad_total,
        stock.cantidad_reservada + stock.cantidad_disponible,
      ),
      `${stock.producto.nombre} no cumple total = reservado + disponible.`,
    );
  }
};

const validateProductIntegrity = async () => {
  const products = await prisma.producto.findMany();

  for (const product of products) {
    if (product.tipo === "FLOR") {
      assertCondition(
        Number(product.precio_venta_actual) > 0,
        `${product.nombre} no tiene precio de venta positivo.`,
      );
      assertCondition(
        Number(product.porcentaje_thc) > 0 &&
          Number(product.porcentaje_thc) <= 100,
        `${product.nombre} tiene THC inválido.`,
      );
      assertCondition(
        product.unidad_medida === "GRAMOS",
        `${product.nombre} debe medirse en gramos.`,
      );
    }

    if (product.tipo === "SEMILLA") {
      assertCondition(
        product.precio_venta_actual === null,
        `${product.nombre} no debe tener precio de venta.`,
      );
      assertCondition(
        product.porcentaje_thc === null,
        `${product.nombre} no debe registrar THC.`,
      );
      assertCondition(
        product.unidad_medida === "UNIDADES",
        `${product.nombre} debe medirse en unidades.`,
      );
    }
  }
};

const validatePurchaseIntegrity = async () => {
  const purchases = await prisma.compra.findMany({
    include: {
      detalles: {
        include: { producto: true },
      },
    },
  });

  for (const purchase of purchases) {
    assertCondition(
      purchase.estado === "REGISTRADA",
      `La compra #${purchase.id} tiene un estado no soportado por el flujo productivo actual.`,
    );
    assertCondition(
      purchase.detalles.length > 0,
      `La compra #${purchase.id} no tiene detalles.`,
    );

    for (const detail of purchase.detalles) {
      assertCondition(
        detail.cantidad > 0 && detail.precio_unitario > 0,
        `La compra #${purchase.id} contiene cantidades o precios no positivos.`,
      );
      assertCondition(
        detail.producto.tipo === "SEMILLA",
        `La compra #${purchase.id} contiene un producto que no es SEMILLA.`,
      );
      assertCondition(
        approximatelyEqual(
          detail.subtotal,
          detail.cantidad * detail.precio_unitario,
        ),
        `El subtotal de la compra #${purchase.id} es inconsistente.`,
      );
    }
  }
};

const validateSaleIntegrity = async () => {
  const sales = await prisma.venta.findMany({
    include: {
      detalles: {
        include: { producto: true },
      },
    },
  });

  for (const sale of sales) {
    const calculatedTotal = sale.detalles.reduce(
      (total, detail) => total + detail.subtotal,
      0,
    );

    assertCondition(
      sale.detalles.length > 0,
      `La venta #${sale.id} no tiene detalles.`,
    );
    assertCondition(
      approximatelyEqual(sale.total, calculatedTotal),
      `El total de la venta #${sale.id} no coincide con sus detalles.`,
    );

    for (const detail of sale.detalles) {
      assertCondition(
        detail.cantidad > 0,
        `La venta #${sale.id} tiene una cantidad no positiva.`,
      );
      assertCondition(
        detail.producto.tipo === "FLOR",
        `La venta #${sale.id} contiene un producto que no es FLOR.`,
      );
      assertCondition(
        approximatelyEqual(
          detail.subtotal,
          detail.cantidad * detail.precio_unitario,
        ),
        `El subtotal de la venta #${sale.id} es inconsistente.`,
      );
    }
  }
};

const validateReservationIntegrity = async () => {
  const reservations = await prisma.reserva.findMany({
    include: {
      detalles: true,
      venta: true,
      historial: true,
    },
  });

  assertCondition(
    reservations.every((reservation) => reservation.estado !== "PENDIENTE"),
    "No deben quedar reservas PENDIENTES porque ese estado es transitorio.",
  );

  for (const reservation of reservations) {
    const calculatedTotal = reservation.detalles.reduce(
      (total, detail) => total + detail.subtotal,
      0,
    );

    assertCondition(
      reservation.detalles.length > 0,
      `La reserva #${reservation.id} no tiene detalles.`,
    );
    assertCondition(
      approximatelyEqual(reservation.total, calculatedTotal),
      `El total de la reserva #${reservation.id} no coincide con sus detalles.`,
    );
    assertCondition(
      reservation.historial.some(
        (history) => history.estado === reservation.estado,
      ),
      `La reserva #${reservation.id} no tiene historial de su estado actual.`,
    );

    if (reservation.estado === "FINALIZADA") {
      assertCondition(
        reservation.venta_id !== null && reservation.venta !== null,
        `La reserva finalizada #${reservation.id} no está vinculada a una venta.`,
      );
    } else {
      assertCondition(
        reservation.venta_id === null,
        `La reserva #${reservation.id} tiene una venta sin estar finalizada.`,
      );
    }
  }

  const confirmedReservedByProduct = await prisma.reservaDetalle.groupBy({
    by: ["producto_id"],
    _sum: { cantidad: true },
    where: {
      reserva: {
        estado: "CONFIRMADA",
      },
    },
  });

  const stocks = await prisma.stock.findMany();

  for (const stock of stocks) {
    const grouped = confirmedReservedByProduct.find(
      (item) => item.producto_id === stock.producto_id,
    );
    const expectedReserved = Number(grouped?._sum.cantidad ?? 0);

    assertCondition(
      approximatelyEqual(stock.cantidad_reservada, expectedReserved),
      `El stock reservado del producto #${stock.producto_id} no coincide con las reservas confirmadas.`,
    );
  }
};

const validateNotificationIntegrity = async () => {
  const notifications = await prisma.notificacion.findMany({
    include: { entregas: true },
  });

  for (const notification of notifications) {
    assertCondition(
      notification.entregas.length === 1,
      `La notificación #${notification.id} debe tener una única entrega demo.`,
    );
    assertCondition(
      notification.entregas[0].estado === notification.estado,
      `La notificación #${notification.id} no coincide con el estado de su entrega.`,
    );
  }
};

const validateMemberStateIntegrity = async () => {
  const members = await prisma.socio.findMany({
    include: { usuario: true },
  });

  for (const member of members) {
    const expectedUserState =
      member.estado === "SUSPENDIDO" ? "BLOQUEADO" : "ACTIVO";

    assertCondition(
      member.usuario.estado === expectedUserState,
      `El socio ${member.nombre} ${member.apellido} no está sincronizado con su usuario.`,
    );
  }
};

const validateLegalLimit = async () => {
  const members = await prisma.socio.findMany({
    where: { estado: "ACTIVO" },
  });

  for (const member of members) {
    const consumption = await calcularConsumoMensualSocio(member.id);

    assertCondition(
      consumption.gramosConsumidos <= 40 + FLOAT_TOLERANCE,
      `El socio ${member.nombre} ${member.apellido} supera el límite legal mensual.`,
    );
  }
};

const validateCounts = async () => {
  const [
    humanAdmins,
    members,
    products,
    providers,
    purchases,
    sales,
    reservations,
    news,
    notifications,
    auditEntries,
    memberStates,
    productStates,
    providerStates,
    saleStates,
    reservationStates,
    newsStates,
    notificationStates,
    consentPending,
  ] = await Promise.all([
    prisma.usuario.count({
      where: {
        rol: "ADMIN",
        estado: "ACTIVO",
      },
    }),
    prisma.socio.count(),
    prisma.producto.count(),
    prisma.proveedor.count(),
    prisma.compra.count(),
    prisma.venta.count(),
    prisma.reserva.count(),
    prisma.novedad.count(),
    prisma.notificacion.count(),
    prisma.auditoria.count(),
    prisma.socio.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.producto.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.proveedor.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.venta.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.reserva.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.novedad.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.notificacion.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.socio.count({ where: { consentimiento_aceptado: false } }),
  ]);

  const groupedCount = (groups, state) =>
    groups.find((group) => group.estado === state)?._count._all ?? 0;

  assertCondition(
    humanAdmins === 2,
    "Deben existir 2 administradores humanos activos.",
  );
  assertCondition(members === 12, "Deben existir 12 socios.");
  assertCondition(
    groupedCount(memberStates, "ACTIVO") === 8,
    "Deben existir 8 socios activos.",
  );
  assertCondition(
    groupedCount(memberStates, "INACTIVO") === 2,
    "Deben existir 2 socios inactivos.",
  );
  assertCondition(
    groupedCount(memberStates, "SUSPENDIDO") === 2,
    "Deben existir 2 socios suspendidos.",
  );
  assertCondition(
    consentPending === 1,
    "Debe existir 1 socio con consentimiento pendiente.",
  );

  assertCondition(products === 8, "Deben existir 8 productos.");
  assertCondition(
    groupedCount(productStates, "ACTIVO") === 7,
    "Deben existir 7 productos activos.",
  );
  assertCondition(
    groupedCount(productStates, "INACTIVO") === 1,
    "Debe existir 1 producto inactivo.",
  );

  assertCondition(providers === 5, "Deben existir 5 proveedores.");
  assertCondition(
    groupedCount(providerStates, "ACTIVO") === 4,
    "Deben existir 4 proveedores activos.",
  );
  assertCondition(
    groupedCount(providerStates, "INACTIVO") === 1,
    "Debe existir 1 proveedor inactivo.",
  );

  assertCondition(purchases === 8, "Deben existir 8 compras.");
  assertCondition(
    sales === 13,
    "Deben existir 13 ventas, incluyendo retiros de reservas.",
  );
  assertCondition(
    groupedCount(saleStates, "REGISTRADA") === 11,
    "Deben existir 11 ventas registradas.",
  );
  assertCondition(
    groupedCount(saleStates, "ANULADA") === 2,
    "Deben existir 2 ventas anuladas.",
  );

  assertCondition(reservations === 12, "Deben existir 12 reservas.");
  assertCondition(
    groupedCount(reservationStates, "CONFIRMADA") === 3,
    "Deben existir 3 reservas confirmadas.",
  );
  assertCondition(
    groupedCount(reservationStates, "CANCELADA") === 2,
    "Deben existir 2 reservas canceladas.",
  );
  assertCondition(
    groupedCount(reservationStates, "VENCIDA") === 2,
    "Deben existir 2 reservas vencidas.",
  );
  assertCondition(
    groupedCount(reservationStates, "FINALIZADA") === 3,
    "Deben existir 3 reservas finalizadas.",
  );
  assertCondition(
    groupedCount(reservationStates, "RECHAZADA") === 2,
    "Deben existir 2 reservas rechazadas.",
  );

  assertCondition(news === 6, "Deben existir 6 novedades.");
  assertCondition(
    groupedCount(newsStates, "ACTIVA") === 4,
    "Deben existir 4 novedades activas.",
  );
  assertCondition(
    groupedCount(newsStates, "INACTIVA") === 2,
    "Deben existir 2 novedades inactivas.",
  );

  assertCondition(notifications === 12, "Deben existir 12 notificaciones.");
  assertCondition(
    groupedCount(notificationStates, "ENVIADA") === 6,
    "Deben existir 6 notificaciones enviadas.",
  );
  assertCondition(
    groupedCount(notificationStates, "PENDIENTE") === 3,
    "Deben existir 3 notificaciones pendientes.",
  );
  assertCondition(
    groupedCount(notificationStates, "ERROR") === 3,
    "Deben existir 3 notificaciones con error.",
  );
  assertCondition(auditEntries >= 30, "Deben existir al menos 30 auditorías.");

  return {
    humanAdmins,
    members,
    products,
    providers,
    purchases,
    sales,
    reservations,
    news,
    notifications,
    auditEntries,
  };
};

const validateSeed = async () => {
  await validateStockIntegrity();
  await validateProductIntegrity();
  await validatePurchaseIntegrity();
  await validateSaleIntegrity();
  await validateReservationIntegrity();
  await validateNotificationIntegrity();
  await validateMemberStateIntegrity();
  await validateLegalLimit();

  return validateCounts();
};

/* =========================================================
   EJECUCIÓN
========================================================= */

const main = async () => {
  const adminPassword = readRequiredEnv("DEMO_SEED_ADMIN_PASSWORD");
  const memberPassword = readRequiredEnv("DEMO_SEED_SOCIO_PASSWORD");

  validateStrongPassword(adminPassword, "DEMO_SEED_ADMIN_PASSWORD");
  validateStrongPassword(memberPassword, "DEMO_SEED_SOCIO_PASSWORD");

  if (adminPassword === memberPassword) {
    throw new Error(
      "Las contraseñas demo de administrador y socio deben ser diferentes.",
    );
  }

  const databaseName = await assertSafeTargetDatabase();
  const dates = getMonthContext();

  console.log(`\n[SEED] Base autorizada: ${databaseName}`);
  console.log("[SEED] Reiniciando exclusivamente la base demo...");
  await resetDatabase();

  console.log("[SEED] Creando usuarios y socios...");
  const { admin, members, credentials } = await createUsersAndMembers({
    adminPassword,
    memberPassword,
    dates,
  });

  console.log("[SEED] Creando productos, proveedores e inventario...");
  const products = await createProducts({ adminId: admin.id, dates });
  const providers = await createProviders({ adminId: admin.id, dates });
  await createInitialFlowerStock({ adminId: admin.id, products, dates });
  await createPurchases({
    adminId: admin.id,
    products,
    providers,
    dates,
  });
  await deactivateHistoricalProvider({
    adminId: admin.id,
    providers,
    dates,
  });

  console.log(
    "[SEED] Generando ventas y reservas mediante servicios reales...",
  );
  await createDirectSales({
    adminId: admin.id,
    members,
    products,
    dates,
  });
  const reservations = await createReservationScenarios({
    adminId: admin.id,
    members,
    products,
    dates,
  });

  console.log("[SEED] Aplicando estados finales de socios...");
  await applyFinalMemberStates({ adminId: admin.id, members });

  console.log("[SEED] Creando novedades y notificaciones controladas...");
  const news = await createNews({ adminId: admin.id, dates });
  await createNotifications({ members, news, reservations, dates });

  console.log("[SEED] Validando consistencia integral...");
  const counts = await validateSeed();

  console.log("\n✅ Seed demo completado y validado.");
  console.table(counts);
  console.log("\nCredenciales de acceso configuradas:");
  console.log(`- Administrador: ${credentials.adminEmail}`);
  console.log(`- Socio principal: ${credentials.memberEmail}`);
  console.log("- Las contraseñas son las definidas en .env.demo.");
};

main()
  .catch((error) => {
    console.error("\n❌ Error ejecutando el seed demo:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
