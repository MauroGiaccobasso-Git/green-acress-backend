import assert from "node:assert/strict";
import { after, test } from "node:test";

import prisma from "../../src/config/prisma.js";
import { confirmarRetiroReserva } from "../../src/services/reservaService.js";
import { assertTestEnvironment } from "../../scripts/testing/assertTestEnvironment.js";

/* =========================================================
   TESTS DE CONCURRENCIA — RETIRO DE RESERVAS
========================================================= */

assertTestEnvironment();

after(async () => {
  await prisma.$disconnect();
});

test("dos confirmaciones simultáneas no pueden retirar dos veces la misma reserva", async () => {
  const identificador = `${Date.now()}-${Math.random()}`;

  let adminId = null;
  let usuarioSocioId = null;
  let socioId = null;
  let productoId = null;
  let reservaId = null;

  try {
    /*
      Creamos un administrador que representa al usuario
      que confirma el retiro presencial desde el frontend.
    */
    const admin = await prisma.usuario.create({
      data: {
        email: `admin-retiro-${identificador}@test.local`,
        password_hash: "test-password-hash",
        rol: "ADMIN",
      },
    });

    adminId = admin.id;

    /*
      Creamos el usuario socio y su registro de Socio.
    */
    const usuarioSocio = await prisma.usuario.create({
      data: {
        email: `socio-retiro-${identificador}@test.local`,
        password_hash: "test-password-hash",
        rol: "SOCIO",
      },
    });

    usuarioSocioId = usuarioSocio.id;

    const socio = await prisma.socio.create({
      data: {
        usuario_id: usuarioSocioId,
        documento: `DOC-${identificador}`,
        nombre: "Socio",
        apellido: "Concurrencia",
        telefono: "099000000",
        consentimiento_aceptado: true,
        fecha_consentimiento: new Date(),
      },
    });

    socioId = socio.id;

    /*
      El producto comienza con:

      - 10 g físicos;
      - 5 g reservados;
      - 5 g disponibles.

      Esto representa una reserva confirmada que todavía
      no fue retirada en el local.
    */
    const producto = await prisma.producto.create({
      data: {
        nombre: `Flor retiro ${identificador}`,
        tipo: "FLOR",
        unidad_medida: "GRAMOS",
        precio_venta_actual: 100,
        stock: {
          create: {
            cantidad_total: 10,
            cantidad_reservada: 5,
            cantidad_disponible: 5,
          },
        },
      },
    });

    productoId = producto.id;

    /*
      Creamos una reserva ya CONFIRMADA.

      Todavía no tiene venta porque el socio aún no realizó
      el retiro físico.
    */
    const reserva = await prisma.reserva.create({
      data: {
        socio_id: socioId,
        usuario_id: usuarioSocioId,
        estado: "CONFIRMADA",
        total: 500,
        fecha_limite_retiro: new Date(Date.now() + 24 * 60 * 60 * 1000),
        detalles: {
          create: {
            producto_id: productoId,
            cantidad: 5,
            precio_unitario: 100,
            subtotal: 500,
          },
        },
      },
    });

    reservaId = reserva.id;

    /*
      Simulamos dos clics simultáneos del administrador
      sobre el botón "Confirmar retiro".

      Solo una operación debe crear la venta y finalizar
      la reserva. La otra debe ser rechazada.
    */
    const resultados = await Promise.allSettled([
      confirmarRetiroReserva({
        reservaId,
        usuarioId: adminId,
        observaciones: "Retiro confirmado por test de concurrencia",
      }),
      confirmarRetiroReserva({
        reservaId,
        usuarioId: adminId,
        observaciones: "Retiro confirmado por test de concurrencia",
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

    /*
      La reserva debe quedar FINALIZADA y vinculada
      a una única venta.
    */
    const reservaFinal = await prisma.reserva.findUnique({
      where: {
        id: reservaId,
      },
    });

    assert.equal(reservaFinal.estado, "FINALIZADA");
    assert.notEqual(reservaFinal.venta_id, null);

    const ventas = await prisma.venta.findMany({
      where: {
        socio_id: socioId,
      },
      include: {
        detalles: true,
      },
    });

    assert.equal(ventas.length, 1);
    assert.equal(ventas[0].estado, "REGISTRADA");
    assert.equal(ventas[0].detalles.length, 1);
    assert.equal(ventas[0].detalles[0].cantidad, 5);

    /*
      El retiro consume únicamente el stock reservado:

      total:      10 → 5
      reservado:   5 → 0
      disponible:  5 → 5
    */
    const stockFinal = await prisma.stock.findUnique({
      where: {
        producto_id: productoId,
      },
    });

    assert.equal(stockFinal.cantidad_total, 5);
    assert.equal(stockFinal.cantidad_reservada, 0);
    assert.equal(stockFinal.cantidad_disponible, 5);

    const movimientosEgreso = await prisma.movimientoStock.count({
      where: {
        producto_id: productoId,
        tipo: "EGRESO",
      },
    });

    assert.equal(movimientosEgreso, 1);

    const historialesFinalizados = await prisma.historialReserva.count({
      where: {
        reserva_id: reservaId,
        estado: "FINALIZADA",
      },
    });

    assert.equal(historialesFinalizados, 1);
  } finally {
    /*
      Limpiamos solamente los registros generados por este test.
      El orden respeta las relaciones entre las tablas.
    */
    if (adminId) {
      await prisma.auditoria.deleteMany({
        where: {
          usuario_id: adminId,
        },
      });
    }

    if (reservaId) {
      await prisma.historialReserva.deleteMany({
        where: {
          reserva_id: reservaId,
        },
      });

      await prisma.reservaDetalle.deleteMany({
        where: {
          reserva_id: reservaId,
        },
      });

      await prisma.reserva.deleteMany({
        where: {
          id: reservaId,
        },
      });
    }

    if (socioId) {
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
    }

    if (productoId) {
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
    }

    if (socioId) {
      await prisma.socio.deleteMany({
        where: {
          id: socioId,
        },
      });
    }

    const usuariosIds = [adminId, usuarioSocioId].filter(Boolean);

    if (usuariosIds.length > 0) {
      await prisma.usuario.deleteMany({
        where: {
          id: {
            in: usuariosIds,
          },
        },
      });
    }
  }
});