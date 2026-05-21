-- CreateTable
CREATE TABLE "HistorialReserva" (
    "id" SERIAL NOT NULL,
    "reserva_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "HistorialReserva_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HistorialReserva" ADD CONSTRAINT "HistorialReserva_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
