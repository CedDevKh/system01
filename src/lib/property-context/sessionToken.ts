import { cookies } from "next/headers";

export async function getSessionTokenFromCookies() {
  const store = await cookies();

  // NextAuth v4 cookie names
  const secure = store.get("__Secure-next-auth.session-token")?.value;
  const regular = store.get("next-auth.session-token")?.value;

  return secure ?? regular ?? null;
}
