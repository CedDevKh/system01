import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const propertyName = process.env.SEED_PROPERTY_NAME ?? "Demo Property";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me";

  const property = await prisma.property.upsert({
    where: { id: "seed_property" },
    update: { name: propertyName },
    create: {
      id: "seed_property",
      name: propertyName,
      timezone: "Asia/Phnom_Penh",
      currency: "USD",
    },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash,
    },
  });

  await prisma.propertyUser.upsert({
    where: {
      propertyId_userId: {
        propertyId: property.id,
        userId: user.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      propertyId: property.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  // Minimal demo data to make the UI buildable early.
  await prisma.roomType.upsert({
    where: { propertyId_code: { propertyId: property.id, code: "STD" } },
    update: {},
    create: {
      propertyId: property.id,
      code: "STD",
      name: "Standard",
      defaultOccupancy: 2,
    },
  });

  console.log("Seed complete:");
  console.log(`- Property: ${property.name} (${property.id})`);
  console.log(`- Admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
