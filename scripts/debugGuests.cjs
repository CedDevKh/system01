const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const guestCount = await prisma.guest.count();
    const reservationCount = await prisma.reservation.count();

    console.log({ guestCount, reservationCount });

    const guests = await prisma.guest.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        propertyId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        updatedAt: true,
      },
    });

    console.log(guests);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
