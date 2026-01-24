"use server";

import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export async function createProperty(formData: FormData) {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;

	if (!userId) {
		redirect("/api/auth/signin");
	}

	const name = String(formData.get("name") ?? "").trim();
	const type = String(formData.get("type") ?? "").trim();
	const timezone = String(formData.get("timezone") ?? "").trim();
	const currency = String(formData.get("currency") ?? "").trim();

	if (!name || !type || !timezone || !currency) {
		throw new Error("Missing required fields");
	}

	const property = await prisma.$transaction(async (tx) => {
		const created = await tx.property.create({
			data: {
				name,
				type: type as any,
				timezone,
				currency,
			} as any,
			select: { id: true },
		});

		await tx.propertyUser.create({
			data: {
				propertyId: created.id,
				userId,
				role: "OWNER",
			},
			select: { id: true },
		});

		return created;
	});

	const store = await cookies();
	store.set({ name: ACTIVE_PROPERTY_COOKIE, value: property.id, path: "/" });

	redirect("/dashboard");
}
