"use server";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { setActivePropertyId } from "@/lib/property-context/activeProperty";
import { prisma } from "@/lib/prisma";

export async function selectProperty(formData: FormData) {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;

	if (!userId) {
		redirect("/api/auth/signin");
	}

	const propertyId = String(formData.get("propertyId") ?? "").trim();
	if (!propertyId) {
		throw new Error("Missing propertyId");
	}

	const membership = await prisma.propertyUser.findFirst({
		where: {
			userId,
			propertyId,
			property: { isActive: true },
		},
		select: { propertyId: true },
	});

	if (!membership) {
		throw new Error("Forbidden");
	}

	await setActivePropertyId(propertyId);
	redirect("/dashboard");
}
