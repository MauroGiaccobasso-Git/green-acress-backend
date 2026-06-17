import bcrypt from "bcrypt";
import prisma from "../../src/config/prisma.js";

async function main() {
  console.log("🧹 Limpiando socios...");
  await prisma.socio.deleteMany();

  console.log("🧹 Limpiando usuarios...");
  await prisma.usuario.deleteMany();

  const passwordHash = await bcrypt.hash("1234", 10);

  await prisma.usuario.create({
    data: {
      email: "admin@test.com",
      password_hash: passwordHash,
      rol: "ADMIN",
      estado: "ACTIVO",
    },
  });

  const usuarioSocio = await prisma.usuario.create({
    data: {
      email: "socio.test@greenacres.com",
      password_hash: passwordHash,
      rol: "SOCIO",
      estado: "ACTIVO",
      socio: {
        create: {
          documento: "12345678",
          nombre: "Socio",
          apellido: "Prueba",
          telefono: "099111111",
          estado: "ACTIVO",
          consentimiento_aceptado: false,
        },
      },
    },
  });

  console.log("✅ Seed usuarios/socios ejecutado correctamente");
  console.log("Admin:", "admin@test.com / 1234");
  console.log("Socio:", "socio.test@greenacres.com / 1234");
}

main()
  .catch((error) => {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });