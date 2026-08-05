import assert from "node:assert/strict";
import { after, test } from "node:test";

import prisma from "../../src/config/prisma.js";
import { descontarStock } from "../../src/services/stockService.js";
import { assertTestEnvironment } from "../../scripts/testing/assertTestEnvironment.js";

/* =========================================================
   TESTS DE CONCURRENCIA — STOCK
========================================================= */

assertTestEnvironment();

after(async () => {
  await prisma.$disconnect();
});

test("dos descuentos simultáneos no pueden dejar el stock negativo", async () => {
  const nombreProducto =
    `Producto concurrencia ${Date.now()}-${Math.random()}`;

  let productoId = null;

  try {
    /*
      Creamos un producto aislado con 10 gramos disponibles.
      No dependemos del seed general del proyecto.
    */
    const producto = await prisma.producto.create({
      data: {
        nombre: nombreProducto,
        tipo: "FLOR",
        unidad_medida: "GRAMOS",
        precio_venta_actual: 100,
        stock: {
          create: {
            cantidad_total: 10,
            cantidad_reservada: 0,
            cantidad_disponible: 10,
          },
        },
      },
    });

    productoId = producto.id;

    /*
      Ambas operaciones intentan descontar 7 gramos al mismo tiempo.

      Sin control de concurrencia podrían aprobarse las dos.
      Con el bloqueo FOR UPDATE solamente una debe completarse.
    */
    const resultados = await Promise.allSettled([
      descontarStock({
        productoId,
        cantidad: 7,
        referenciaTipo: "TEST_CONCURRENCIA",
      }),
      descontarStock({
        productoId,
        cantidad: 7,
        referenciaTipo: "TEST_CONCURRENCIA",
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

    const stockFinal = await prisma.stock.findUnique({
      where: {
        producto_id: productoId,
      },
    });

    assert.equal(stockFinal.cantidad_total, 3);
    assert.equal(stockFinal.cantidad_disponible, 3);
    assert.equal(stockFinal.cantidad_reservada, 0);

    const movimientos = await prisma.movimientoStock.count({
      where: {
        producto_id: productoId,
        tipo: "EGRESO",
        referencia_tipo: "TEST_CONCURRENCIA",
      },
    });

    assert.equal(movimientos, 1);
  } finally {
    /*
      Limpiamos únicamente los datos creados por este test.
      Nunca se toca información de otra base.
    */
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
  }
});