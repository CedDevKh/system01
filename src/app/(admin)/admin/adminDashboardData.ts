import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/adminContext";

export type AdminDashboardData = {
  superAdminEmail: string;
  totalUsers: number;
  totalProperties: number;
  totalDemoRequests: number;
  recentDemoRequests: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    country: string | null;
    propertyName: string | null;
    createdAt: Date;
  }[];
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const superAdmin = await requireSuperAdmin();

  const [totalUsers, totalProperties, totalDemoRequests, recentDemoRequests] =
    await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.demoRequest.count(),
      prisma.demoRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          country: true,
          propertyName: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    superAdminEmail: superAdmin.email ?? "",
    totalUsers,
    totalProperties,
    totalDemoRequests,
    recentDemoRequests: recentDemoRequests.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      country: r.country ?? null,
      propertyName: r.propertyName,
      createdAt: r.createdAt,
    })),
  };
}
