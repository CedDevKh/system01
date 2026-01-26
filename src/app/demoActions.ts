"use server";

import { prisma } from "@/lib/prisma";

export type DemoRequestState = {
  ok: boolean;
  error?: string;
};

export async function submitDemoRequest(
  prevState: DemoRequestState,
  formData: FormData
): Promise<DemoRequestState> {
  const firstName = formData.get("firstName")?.toString().trim() || "";
  const lastName = formData.get("lastName")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const country = formData.get("country")?.toString().trim() || "";
  const phone = formData.get("phone")?.toString().trim() || "";
  const jobRole = formData.get("jobRole")?.toString().trim() || "";
  const propertyName = formData.get("propertyName")?.toString().trim() || "";
  const propertyType = formData.get("propertyType")?.toString().trim() || "";
  const roomsCountRaw = formData.get("roomsCount")?.toString().trim();
  const message = formData.get("message")?.toString().trim() || "";

  if (!firstName || !lastName || !email || !propertyName) {
    return {
      ok: false,
      error: "Please fill in your name, email, and property name.",
    };
  }

  let roomsCount: number | undefined;
  if (roomsCountRaw) {
    const parsed = Number(roomsCountRaw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      roomsCount = parsed;
    }
  }

  await prisma.demoRequest.create({
    data: {
      firstName,
      lastName,
      email,
      country: country || null,
      phone: phone || null,
      jobRole: jobRole || null,
      propertyName,
      propertyType: propertyType || null,
      roomsCount,
      message: message || null,
    },
  });

  return { ok: true };
}
