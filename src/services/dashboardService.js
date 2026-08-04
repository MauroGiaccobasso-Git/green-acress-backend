import prisma from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { generarRecomendacionesStockConIA } from "./ai/geminiProvider.js";

/* =========================================================
   CONSTANTES DEL MÓDULO
========================================================= */

const ZONA_HORARIA = "America/Montevideo";
const HORAS_ALERTA_RESERVAS = 24;
const DIAS_ANALISIS = 30;
const LIMITE_ALERTAS = 5;
const LIMITE_PRODUCTOS = 5;
const MULTIPLO_GRAMOS = 0.5;

const PRIORIDADES_VALIDAS = ["ALTA", "MEDIA", "BAJA"];
const ORDEN_PRIORIDAD = { ALTA: 0, MEDIA: 1, BAJA: 2 };

/* =========================================================
   HELPERS GENERALES
========================================================= */

const normalizarNumero = (valor, decimales = 2) => {
  const numero = Number(valor ?? 0);

  return Number.isFinite(numero)
    ? Number(numero.toFixed(decimales))
    : 0;
};

/*
Normaliza la URL almacenada en base de datos.

Una cadena vacía o compuesta solamente por espacios se
transforma en null para que el frontend active correctamente
su representación visual de respaldo.
*/
const normalizarImagenUrl = (valor) => {
  const imagenUrl = String(valor ?? "").trim();

  return imagenUrl || null;
};

const sumarCantidades = (detalles = []) =>
  normalizarNumero(
    detalles.reduce(
      (total, detalle) =>
        total + Number(detalle.cantidad ?? 0),
      0,
    ),
  );

const redondearHaciaArriba = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return 0;
  }

  return normalizarNumero(
    Math.ceil(numero / MULTIPLO_GRAMOS) *
      MULTIPLO_GRAMOS,
  );
};

const obtenerClaveFechaMontevideo = (fecha) => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(fecha));

  const valores = Object.fromEntries(
    partes
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );

  return `${valores.year}-${valores.month}-${valores.day}`;
};

const obtenerRangosTemporales = async () => {
  /*
   * PostgreSQL calcula los límites utilizando la hora local de Montevideo.
   *
   * Los valores se devuelven como milisegundos Unix para evitar que el
   * driver de PostgreSQL interprete incorrectamente timestamps sin zona
   * horaria al convertirlos en objetos Date de JavaScript.
   */
  const [rangos] = await prisma.$queryRaw`
    SELECT
      (
        EXTRACT(
          EPOCH FROM (
            date_trunc(
              'month',
              CURRENT_TIMESTAMP AT TIME ZONE 'America/Montevideo'
            ) AT TIME ZONE 'America/Montevideo'
          )
        ) * 1000
      )::bigint AS "inicioMesMs",

      (
        EXTRACT(
          EPOCH FROM (
            (
              date_trunc(
                'month',
                CURRENT_TIMESTAMP AT TIME ZONE 'America/Montevideo'
              ) + INTERVAL '1 month'
            ) AT TIME ZONE 'America/Montevideo'
          )
        ) * 1000
      )::bigint AS "inicioMesSiguienteMs",

      (
        EXTRACT(
          EPOCH FROM (
            (
              date_trunc(
                'day',
                CURRENT_TIMESTAMP AT TIME ZONE 'America/Montevideo'
              ) - INTERVAL '29 days'
            ) AT TIME ZONE 'America/Montevideo'
          )
        ) * 1000
      )::bigint AS "inicioUltimos30DiasMs",

      (
        EXTRACT(
          EPOCH FROM (
            (
              date_trunc(
                'day',
                CURRENT_TIMESTAMP AT TIME ZONE 'America/Montevideo'
              ) + INTERVAL '1 day'
            ) AT TIME ZONE 'America/Montevideo'
          )
        ) * 1000
      )::bigint AS "finUltimos30DiasMs"
  `;

  return {
    inicioMes: new Date(Number(rangos.inicioMesMs)),
    inicioMesSiguiente: new Date(
      Number(rangos.inicioMesSiguienteMs),
    ),
    inicioUltimos30Dias: new Date(
      Number(rangos.inicioUltimos30DiasMs),
    ),
    finUltimos30Dias: new Date(
      Number(rangos.finUltimos30DiasMs),
    ),
  };
};

const resumirErrorEntrega = (detalle) => {
  const texto = String(detalle ?? "").toLowerCase();

  if (
    texto.includes("timeout") ||
    texto.includes("etimedout")
  ) {
    return "El proveedor no respondió dentro del tiempo esperado.";
  }

  if (
    texto.includes("econnrefused") ||
    texto.includes("enotfound") ||
    texto.includes("network") ||
    texto.includes("socket")
  ) {
    return "No fue posible conectar con el proveedor de notificaciones.";
  }

  if (
    texto.includes("auth") ||
    texto.includes("credential") ||
    texto.includes("535")
  ) {
    return "El proveedor rechazó la autenticación del servicio.";
  }

  if (
    texto.includes("rate limit") ||
    texto.includes("too many") ||
    texto.includes("429")
  ) {
    return "El proveedor limitó temporalmente la cantidad de envíos.";
  }

  if (
    texto.includes("recipient") ||
    texto.includes("mailbox") ||
    texto.includes("550")
  ) {
    return "El proveedor rechazó el destinatario de la notificación.";
  }

  return "No fue posible completar la entrega.";
};

const construirOrigenEntrega = (notificacion) => {
  if (
    notificacion.origen_tipo === "RESERVA" &&
    Number.isInteger(notificacion.origen_id)
  ) {
    return {
      tipo: "RESERVA",
      id: notificacion.origen_id,
      etiqueta: `Reserva #${notificacion.origen_id}`,
    };
  }

  if (notificacion.novedad_id) {
    return {
      tipo: "NOVEDAD",
      id: notificacion.novedad_id,
      etiqueta:
        notificacion.novedad?.titulo ||
        `Novedad #${notificacion.novedad_id}`,
    };
  }

  return {
    tipo: "SISTEMA",
    id: null,
    etiqueta: notificacion.tipo,
  };
};

/* =========================================================
   KPI DEL DASHBOARD
========================================================= */

const obtenerResumenDashboard = async ({
  inicioMes,
  inicioMesSiguiente,
}) => {
  const filtroVentasMes = {
    estado: "REGISTRADA",
    fecha: {
      gte: inicioMes,
      lt: inicioMesSiguiente,
    },
  };

  const [
    cantidadVentas,
    importeVentas,
    gramosVendidos,
    sociosActivos,
  ] = await Promise.all([
    prisma.venta.count({
      where: filtroVentasMes,
    }),

    prisma.venta.aggregate({
      where: filtroVentasMes,
      _sum: {
        total: true,
      },
    }),

    prisma.ventaDetalle.aggregate({
      where: {
        venta: filtroVentasMes,
        producto: {
          tipo: "FLOR",
        },
      },
      _sum: {
        cantidad: true,
      },
    }),

    prisma.socio.count({
      where: {
        estado: "ACTIVO",
      },
    }),
  ]);

  return {
    ventasMes: cantidadVentas,
    importeVentasMes: normalizarNumero(
      importeVentas._sum.total,
    ),
    gramosVendidosMes: normalizarNumero(
      gramosVendidos._sum.cantidad,
    ),
    sociosActivos,
  };
};

/* =========================================================
   ATENCIÓN REQUERIDA
========================================================= */

const obtenerReservasProximasVencer = async (ahora) => {
  const hasta = new Date(
    ahora.getTime() +
      HORAS_ALERTA_RESERVAS * 60 * 60 * 1000,
  );

  const where = {
    estado: "CONFIRMADA",
    fecha_limite_retiro: {
      gte: ahora,
      lte: hasta,
    },
  };

  const [total, reservas] = await Promise.all([
    prisma.reserva.count({
      where,
    }),

    prisma.reserva.findMany({
      where,
      take: LIMITE_ALERTAS,
      orderBy: {
        fecha_limite_retiro: "asc",
      },
      select: {
        id: true,
        fecha_limite_retiro: true,
        socio: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        detalles: {
          select: {
            cantidad: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    items: reservas.map((reserva) => ({
      reservaId: reserva.id,
      socio: {
        id: reserva.socio.id,
        nombreCompleto:
          `${reserva.socio.nombre} ${reserva.socio.apellido}`.trim(),
      },
      fechaLimiteRetiro: reserva.fecha_limite_retiro,
      gramosReservados: sumarCantidades(
        reserva.detalles,
      ),
    })),
  };
};

const obtenerFloresSinStock = async () => {
  const where = {
    tipo: "FLOR",
    estado: "ACTIVO",
    stock: {
      is: {
        cantidad_disponible: {
          lte: 0,
        },
      },
    },
  };

  const [total, productos] = await Promise.all([
    prisma.producto.count({
      where,
    }),

    prisma.producto.findMany({
      where,
      take: LIMITE_ALERTAS,
      orderBy: {
        nombre: "asc",
      },
      select: {
        id: true,
        nombre: true,
        stock: {
          select: {
            cantidad_total: true,
            cantidad_reservada: true,
            cantidad_disponible: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    items: productos.map((producto) => ({
      productoId: producto.id,
      nombre: producto.nombre,
      cantidadTotal: normalizarNumero(
        producto.stock.cantidad_total,
      ),
      cantidadReservada: normalizarNumero(
        producto.stock.cantidad_reservada,
      ),
      cantidadDisponible: normalizarNumero(
        producto.stock.cantidad_disponible,
      ),
      motivo:
        Number(producto.stock.cantidad_total) <= 0
          ? "SIN_EXISTENCIAS"
          : "TODO_RESERVADO",
    })),
  };
};

const obtenerEntregasConError = async (
  inicioUltimos30Dias,
) => {
  const where = {
    estado: "ERROR",
    OR: [
      {
        fecha_ultimo_intento: {
          gte: inicioUltimos30Dias,
        },
      },
      {
        fecha_ultimo_intento: null,
        fecha_creacion: {
          gte: inicioUltimos30Dias,
        },
      },
    ],
  };

  const [total, entregas] = await Promise.all([
    prisma.notificacionEntrega.count({
      where,
    }),

    prisma.notificacionEntrega.findMany({
      where,
      take: LIMITE_ALERTAS,
      orderBy: [
        {
          fecha_creacion: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        canal: true,
        intentos: true,
        fecha_ultimo_intento: true,
        fecha_creacion: true,
        error_detalle: true,
        notificacion: {
          select: {
            id: true,
            tipo: true,
            origen_id: true,
            origen_tipo: true,
            novedad_id: true,
            novedad: {
              select: {
                titulo: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    total,
    items: entregas.map((entrega) => ({
      entregaId: entrega.id,
      notificacionId: entrega.notificacion.id,
      tipoNotificacion: entrega.notificacion.tipo,
      canal: entrega.canal,
      intentos: entrega.intentos,
      fechaUltimoIntento:
        entrega.fecha_ultimo_intento ||
        entrega.fecha_creacion,
      error: resumirErrorEntrega(
        entrega.error_detalle,
      ),
      origen: construirOrigenEntrega(
        entrega.notificacion,
      ),
    })),
  };
};

const obtenerAtencionRequerida = async ({
  ahora,
  inicioUltimos30Dias,
}) => {
  const [
    reservasProximasVencer,
    floresSinStock,
    entregasConError,
  ] = await Promise.all([
    obtenerReservasProximasVencer(ahora),
    obtenerFloresSinStock(),
    obtenerEntregasConError(inicioUltimos30Dias),
  ]);

  return {
    reservasProximasVencer,
    floresSinStock,
    entregasConError,
  };
};

/* =========================================================
   DEMANDA Y PRODUCTOS MÁS DEMANDADOS
========================================================= */

const obtenerBaseDemanda = async ({
  inicioUltimos30Dias,
  finUltimos30Dias,
}) => {
  const [ventas, reservas, productos] =
    await Promise.all([
      prisma.ventaDetalle.findMany({
        where: {
          venta: {
            estado: "REGISTRADA",
            fecha: {
              gte: inicioUltimos30Dias,
              lt: finUltimos30Dias,
            },
          },
          producto: {
            tipo: "FLOR",
          },
        },
        select: {
          producto_id: true,
          cantidad: true,
          venta: {
            select: {
              fecha: true,
            },
          },
        },
      }),

      prisma.reservaDetalle.findMany({
        where: {
          reserva: {
            estado: "CONFIRMADA",
            fecha_solicitud: {
              gte: inicioUltimos30Dias,
              lt: finUltimos30Dias,
            },
          },
          producto: {
            tipo: "FLOR",
          },
        },
        select: {
          producto_id: true,
          cantidad: true,
          reserva: {
            select: {
              fecha_solicitud: true,
            },
          },
        },
      }),

      prisma.producto.findMany({
        where: {
          tipo: "FLOR",
        },
        select: {
          id: true,
          nombre: true,
          estado: true,
          imagen_url: true,
          stock: {
            select: {
              cantidad_total: true,
              cantidad_reservada: true,
              cantidad_disponible: true,
            },
          },
        },
      }),
    ]);

  return {
    ventas,
    reservas,
    productos,
  };
};

const construirDemanda = ({
  ventas,
  reservas,
  productos,
  inicioUltimos30Dias,
  finUltimos30Dias,
}) => {
  const evolucionPorFecha = new Map();
  const demandaPorProducto = new Map();

  for (
    let indice = 0;
    indice < DIAS_ANALISIS;
    indice += 1
  ) {
    const fecha = new Date(
      inicioUltimos30Dias.getTime() +
        indice * 24 * 60 * 60 * 1000,
    );

    const claveFecha =
      obtenerClaveFechaMontevideo(fecha);

    evolucionPorFecha.set(claveFecha, {
      fecha: claveFecha,
      gramosVendidos: 0,
      gramosReservados: 0,
    });
  }

  const obtenerAcumulado = (productoId) => {
    if (!demandaPorProducto.has(productoId)) {
      demandaPorProducto.set(productoId, {
        gramosVendidos: 0,
        gramosReservados: 0,
      });
    }

    return demandaPorProducto.get(productoId);
  };

  for (const detalle of ventas) {
    const cantidad = Number(
      detalle.cantidad ?? 0,
    );

    const fecha = obtenerClaveFechaMontevideo(
      detalle.venta.fecha,
    );

    const dia = evolucionPorFecha.get(fecha);

    if (dia) {
      dia.gramosVendidos += cantidad;
    }

    obtenerAcumulado(
      detalle.producto_id,
    ).gramosVendidos += cantidad;
  }

  for (const detalle of reservas) {
    const cantidad = Number(
      detalle.cantidad ?? 0,
    );

    const fecha = obtenerClaveFechaMontevideo(
      detalle.reserva.fecha_solicitud,
    );

    const dia = evolucionPorFecha.get(fecha);

    if (dia) {
      dia.gramosReservados += cantidad;
    }

    obtenerAcumulado(
      detalle.producto_id,
    ).gramosReservados += cantidad;
  }

  const productosMasDemandados = productos
    .map((producto) => {
      const demanda =
        demandaPorProducto.get(producto.id) || {
          gramosVendidos: 0,
          gramosReservados: 0,
        };

      const demandaTotal =
        demanda.gramosVendidos +
        demanda.gramosReservados;

      return {
        productoId: producto.id,
        nombre: producto.nombre,
        imagenUrl: normalizarImagenUrl(
          producto.imagen_url,
        ),
        estado: producto.estado,
        gramosVendidos: normalizarNumero(
          demanda.gramosVendidos,
        ),
        gramosReservados: normalizarNumero(
          demanda.gramosReservados,
        ),
        demandaTotal: normalizarNumero(
          demandaTotal,
        ),
        cantidadTotal: normalizarNumero(
          producto.stock?.cantidad_total,
        ),
        cantidadReservada: normalizarNumero(
          producto.stock?.cantidad_reservada,
        ),
        cantidadDisponible: normalizarNumero(
          producto.stock?.cantidad_disponible,
        ),
      };
    })
    .filter(
      (producto) =>
        producto.demandaTotal > 0,
    )
    .sort(
      (first, second) =>
        second.demandaTotal -
          first.demandaTotal ||
        first.nombre.localeCompare(
          second.nombre,
          "es",
        ),
    )
    .slice(0, LIMITE_PRODUCTOS);

  return {
    periodo: {
      desde: inicioUltimos30Dias,
      hasta: finUltimos30Dias,
      dias: DIAS_ANALISIS,
    },

    evolucionDiaria: Array.from(
      evolucionPorFecha.values(),
    ).map((item) => ({
      ...item,
      gramosVendidos: normalizarNumero(
        item.gramosVendidos,
      ),
      gramosReservados: normalizarNumero(
        item.gramosReservados,
      ),
    })),

    productosMasDemandados,
  };
};

/* =========================================================
   RECOMENDACIONES INTELIGENTES
========================================================= */

const construirCandidatosRecomendacion = ({
  ventas,
  reservas,
  productos,
}) => {
  const demandaPorProducto = new Map();

  const obtenerAcumulado = (productoId) => {
    if (!demandaPorProducto.has(productoId)) {
      demandaPorProducto.set(productoId, {
        gramosVendidos: 0,
        gramosReservados: 0,
      });
    }

    return demandaPorProducto.get(productoId);
  };

  ventas.forEach((detalle) => {
    obtenerAcumulado(
      detalle.producto_id,
    ).gramosVendidos += Number(
      detalle.cantidad ?? 0,
    );
  });

  reservas.forEach((detalle) => {
    obtenerAcumulado(
      detalle.producto_id,
    ).gramosReservados += Number(
      detalle.cantidad ?? 0,
    );
  });

  return productos
    .filter(
      (producto) =>
        producto.estado === "ACTIVO" &&
        producto.stock,
    )
    .map((producto) => {
      const demanda =
        demandaPorProducto.get(producto.id) || {
          gramosVendidos: 0,
          gramosReservados: 0,
        };

      const stockDisponible = Number(
        producto.stock.cantidad_disponible ?? 0,
      );

      const necesidad =
        demanda.gramosVendidos +
        demanda.gramosReservados -
        stockDisponible;

      return {
        productoId: producto.id,
        producto: producto.nombre,
        imagenUrl: normalizarImagenUrl(
          producto.imagen_url,
        ),
        gramosVendidos30Dias:
          normalizarNumero(
            demanda.gramosVendidos,
          ),
        gramosReservados:
          normalizarNumero(
            demanda.gramosReservados,
          ),
        stockDisponible:
          normalizarNumero(
            stockDisponible,
          ),
        cantidadSugerida:
          redondearHaciaArriba(
            necesidad,
          ),
      };
    })
    .filter(
      (candidato) =>
        candidato.cantidadSugerida > 0,
    )
    .sort(
      (first, second) =>
        second.cantidadSugerida -
          first.cantidadSugerida ||
        first.producto.localeCompare(
          second.producto,
          "es",
        ),
    )
    .slice(0, LIMITE_PRODUCTOS);
};

const validarRecomendacionesIA = (
  respuesta,
  candidatos,
) => {
  if (!Array.isArray(respuesta)) {
    throw new AppError(
      "El servicio de inteligencia artificial devolvió una respuesta inválida",
      502,
      "AI_INVALID_RESPONSE",
    );
  }

  const candidatosPorId = new Map(
    candidatos.map((candidato) => [
      candidato.productoId,
      candidato,
    ]),
  );

  const idsUtilizados = new Set();

  const recomendaciones = respuesta.map(
    (item) => {
      const productoId = Number(
        item?.productoId,
      );

      const prioridad = String(
        item?.prioridad ?? "",
      ).toUpperCase();

      const justificacion = String(
        item?.justificacion ?? "",
      ).trim();

      const candidato =
        candidatosPorId.get(productoId);

      if (
        !candidato ||
        idsUtilizados.has(productoId) ||
        !PRIORIDADES_VALIDAS.includes(
          prioridad,
        ) ||
        !justificacion ||
        justificacion.length > 500
      ) {
        throw new AppError(
          "El servicio de inteligencia artificial devolvió una respuesta inválida",
          502,
          "AI_INVALID_RESPONSE",
        );
      }

      idsUtilizados.add(productoId);

      /*
      La recomendación final reutiliza los datos validados por
      backend, incluida imagenUrl.

      Gemini solamente aporta prioridad y justificación.
      */
      return {
        ...candidato,
        prioridad,
        justificacion,
      };
    },
  );

  return recomendaciones
    .slice(0, LIMITE_PRODUCTOS)
    .sort(
      (first, second) =>
        ORDEN_PRIORIDAD[first.prioridad] -
          ORDEN_PRIORIDAD[second.prioridad] ||
        second.cantidadSugerida -
          first.cantidadSugerida,
    );
};

/* =========================================================
   OPERACIONES PRINCIPALES
========================================================= */

export const obtenerDashboardAdministrativo =
  async () => {
    const ahora = new Date();
    const rangos =
      await obtenerRangosTemporales();

    const [
      resumen,
      atencionRequerida,
      baseDemanda,
    ] = await Promise.all([
      obtenerResumenDashboard(rangos),

      obtenerAtencionRequerida({
        ahora,
        inicioUltimos30Dias:
          rangos.inicioUltimos30Dias,
      }),

      obtenerBaseDemanda(rangos),
    ]);

    return {
      resumen,
      atencionRequerida,
      demanda: construirDemanda({
        ...baseDemanda,
        inicioUltimos30Dias:
          rangos.inicioUltimos30Dias,
        finUltimos30Dias:
          rangos.finUltimos30Dias,
      }),
      generatedAt: ahora.toISOString(),
      timeZone: ZONA_HORARIA,
    };
  };

export const generarRecomendacionesDashboard =
  async () => {
    const ahora = new Date();
    const rangos =
      await obtenerRangosTemporales();

    const baseDemanda =
      await obtenerBaseDemanda(rangos);

    const candidatos =
      construirCandidatosRecomendacion(
        baseDemanda,
      );

    if (candidatos.length === 0) {
      return {
        recomendaciones: [],
        generatedAt: ahora.toISOString(),
      };
    }

    try {
      /*
      geminiProvider crea una copia con campos permitidos.

      imagenUrl permanece en candidatos para construir
      la respuesta final, pero nunca se envía al proveedor.
      */
      const respuesta =
        await generarRecomendacionesStockConIA(
          candidatos,
        );

      return {
        recomendaciones:
          validarRecomendacionesIA(
            respuesta,
            candidatos,
          ),
        generatedAt: ahora.toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error(
        "[DASHBOARD] No fue posible generar recomendaciones inteligentes:",
        error,
      );

      throw new AppError(
        "Las recomendaciones inteligentes no se encuentran disponibles temporalmente",
        503,
        "AI_SERVICE_UNAVAILABLE",
      );
    }
  };