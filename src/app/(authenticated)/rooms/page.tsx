export default async function RoomsAndUnitsPage() {
  const { redirect } = await import("next/navigation");
  redirect("/pms/rooms");
}
