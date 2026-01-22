import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    // CredentialsProvider requires JWT sessions.
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist the user id into the token for later session hydration.
      if (user) {
        (token as any).userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user id for server-side authorization checks.
      if (session.user) {
        session.user.id = ((token as any).userId as string) ?? (token.sub as string);
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always land on /dashboard after auth.
      // If NextAuth gives us a relative path, keep it within this origin.
      if (url.startsWith("/")) {
        return url === "/" ? `${baseUrl}/dashboard` : `${baseUrl}${url}`;
      }

      // If NextAuth gives an absolute URL for this origin, allow it unless it's root.
      if (url.startsWith(baseUrl)) {
        const path = url.slice(baseUrl.length);
        if (path === "" || path === "/" || path.startsWith("/api/auth")) {
          return `${baseUrl}/dashboard`;
        }
        return url;
      }

      // Fallback to dashboard for external/unexpected urls.
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    // Keep default NextAuth pages for now.
  },
};
