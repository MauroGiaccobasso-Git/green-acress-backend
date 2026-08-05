import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import prisma from "../../src/config/prisma.js";
import {
  anularVenta,
  registrarVenta,
} from "../../src/services/ventaService.js";
import { assertTestEnvironment } from "../../scripts/testing/assertTestEnvironment.js";

/* =========================================================
   TESTS DE CONCURRENCIA — VENTAS
========================================================= */

assertTestEnvironment();

after(async () => {
  await prisma.$disconnect();
});

/* =========================================================
   FIXTURES
========================================================= */

/*
  Crea únicamente los datos mínimos necesarios para probar ventas.

  Cada test recibe sus propios registros aislados y no depende
  del seed general del proyecto.
*/
const crearContextoVenta = async ({ stockInicial }) => {
  const identificador = randomUUID();

  const admin = await prisma.usuario.create({
    data: {
      email: `admin-ventas-${identificador}@test.local`,
      password_hash: "test-password-hash",
      rol: "ADMIN",
    },
  });

  const usuarioSocio = await prisma.usuario.create({
    data: {
      email: `socio-ventas-${identificador}@test.local`,
      password_hash: "test-password-hash",
      rol: "SOCIO",
    },
  });

  const socio = await prisma.socio.create({
    data: {
      usuario_id: usuarioSocio.id,
      documento: `DOC-${identificador}`,
      nombre: "Socio",
      apellido: "Concurrencia",
      telefono: "099000000",
      consentimiento_aceptado: true,
      fecha_consentimiento: new Date(),
    },
  });

  const producto = await prisma.producto.create({
    data: {
      nombre: `Flor ventas ${identificador}`,
      tipo: "FLOR",
      unidad_medida: "GRAMOS",
      precio_venta_actual: 100,
      stock: {
        create: {
          cantidad_total: stockInicial,
          cantidad_reservada: 0,
          cantidad_disponible: stockInicial,
        },
      },
    },
  });

  return {
    adminId: admin.id,
    usuarioSocioId: usuarioSocio.id,
    socioId: socio.id,
    productoId: producto.id,
  };
};

/*
  Elimina solamente los registros generados por el test actual.

  La limpieza ocurre en orden para respetar las relaciones
  entre ventas, productos, socios y usuarios.
*/
const limpiarContextoVenta = async (contexto) => {
  if (!contexto) {
    return;
  }

  const {
    adminId,
    usuarioSocioId,
    socioId,
    productoId,
  } = contexto;

  const ventas = await prisma.venta.findMany({
    where: {
      socio_id: socioId,
    },
    select: {
      id: true,
    },
  });

  const ventaIds = ventas.map((venta) => venta.id);

  if (ventaIds.length > 0) {
    await prisma.ventaDetalle.deleteMany({
      where: {
        venta_id: {
          in: ventaIds,
        },
      },
    });

    await prisma.venta.deleteMany({
      where: {
        id: {
          in: ventaIds,
        },
      },
    });
  }

  await prisma.auditoria.deleteMany({
    where: {
      usuario_id: adminId,
    },
  });

  await prisma.movimientoStock.deleteMany({
    where: {
      producto_id: productoId,
    },
  });

  await prisma.stock.deleteMany({
    where: {
      producto_id: productoId,
    },
  });

  await prisma.producto.deleteMany({
    where: {
      id: productoId,
    },
  });

  await prisma.socio.deleteMany({
    where: {
      id: socioId,
    },
  });

  await prisma.usuario.deleteMany({
    where: {
      id: {
        in: [adminId, usuarioSocioId],
      },
    },
  });
};

/* =========================================================
   LÍMITE LEGAL MENSUAL
========================================================= */

test("dos ventas simultáneas no pueden superar el límite mensual de 40 g", async () => {
  let contexto = null;

  try {
    contexto = await crearContextoVenta({
      stockInicial: 100,
    });

    /*
      Ambas ventas intentan registrar 25 g para el mismo socio.

      Individualmente son válidas, pero juntas sumarían 50 g
      y superarían el límite legal mensual de 40 g.

      El bloqueo sobre Socio debe permitir una sola venta.
    */
    const resultados = await Promise.allSettled([
      registrarVenta({
        socioId: contexto.socioId,
        usuarioId: contexto.adminId,
        detalles: [
          {
            producto_id: contexto.productoId,
            cantidad: 25,
          },
        ],
        observaciones: "Venta concurrente A",
      }),
      registrarVenta({
        socioId: contexto.socioId,
        usuarioId: contexto.adminId,
        detalles: [
          {
            producto_id: contexto.productoId,
            cantidad: 25,
          },
        ],
        observaciones: "Venta concurrente B",
      }),
    ]);

    const exitosas = resultados.filter(
      (resultado) => resultado.status === "fulfilled",
    );

    const rechazadas = resultados.filter(
      (resultado) => resultado.status === "rejected",
    );

    assert.equal(exitosas.length, 1);
    assert.equal(rechazadas.length, 1);

    const ventasRegistradas = await prisma.venta.findMany({
      where: {
        socio_id: contexto.socioId,
        estado: "REGISTRADA",
      },
      include: {
        detalles: true,
      },
    });

    assert.equal(ventasRegistradas.length, 1);
    assert.equal(ventasRegistradas[0].detalles.length, 1);
    assert.equal(ventasRegistradas[0].detalles[0].cantidad, 25);

    /*
      Solo una venta debe haber descontado stock.

      total:      100 → 75
      disponible: 100 → 75
    */
    const stockFinal = await prisma.stock.findUnique({
      where: {
        producto_id: contexto.productoId,
      },
    });

    assert.equal(stockFinal.cantidad_total, 75);
    assert.equal(stockFinal.cantidad_disponible, 75);
    assert.equal(stockFinal.cantidad_reservada, 0);

    const movimientosEgreso = await prisma.movimientoStock.count({
      where: {
        producto_id: contexto.productoId,
        tipo: "EGRESO",
      },
    });

    assert.equal(movimientosEgreso, 1);
  } finally {
    await limpiarContextoVenta(contexto);
  }
});

/* =========================================================
   ANULACIÓN DE VENTAS
========================================================= */

test("dos anulaciones simultáneas no pueden devolver dos veces el stock", async () => {
  let contexto = null;

  try {
    contexto = await crearContextoVenta({
      stockInicial: 10,
    });

    /*
      Primero registramos una venta real de 4 g.

      El stock debe pasar de 10 g a 6 g.
    */
    const venta = await registrarVenta({
      socioId: contexto.socioId,
      usuarioId: contexto.adminId,
      detalles: [
        {
          producto_id: contexto.productoId,
          cantidad: 4,
        },
      ],
      observaciones: "Venta preparada para anulación concurrente",
    });

    const stockLuegoDeVenta = await prisma.stock.findUnique({
      where: {
        producto_id: contexto.productoId,
      },
    });

    assert.equal(stockLuegoDeVenta.cantidad_total, 6);
    assert.equal(stockLuegoDeVenta.cantidad_disponible, 6);

    /*
      Simulamos dos solicitudes simultáneas para anular
      exactamente la misma venta.

      Solo una debe cambiarla a ANULADA y devolver los 4 g.
    */
    const resultados = await Promise.allSettled([
      anularVenta({
        ventaId: venta.id,
        usuarioId: contexto.adminId,
      }),
      anularVenta({
        ventaId: venta.id,
        usuarioId: contexto.adminId,
      }),
    ]);

    const exitosas = resultados.filter(
      (resultado) => resultado.status === "fulfilled",
    );

    const rechazadas = resultados.filter(
      (resultado) => resultado.status === "rejected",
    );

    assert.equal(exitosas.length, 1);
    assert.equal(rechazadas.length, 1);

    const ventaFinal = await prisma.venta.findUnique({
      where: {
        id: venta.id,
      },
    });

    assert.equal(ventaFinal.estado, "ANULADA");

    /*
      Los 4 g deben devolverse una sola vez.

      Resultado correcto: 10 g.
      Resultado incorrecto por doble devolución: 14 g.
    */
    const stockFinal = await prisma.stock.findUnique({
      where: {
        producto_id: contexto.productoId,
      },
    });

    assert.equal(stockFinal.cantidad_total, 10);
    assert.equal(stockFinal.cantidad_disponible, 10);
    assert.equal(stockFinal.cantidad_reservada, 0);
  } finally {
    await limpiarContextoVenta(contexto);
  }
});