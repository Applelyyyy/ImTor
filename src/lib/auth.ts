import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "./db";
import { AppError } from "./errors";
import { isAdmin } from "./permissions";
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "database", maxAge: 7 * 24 * 60 * 60 },
  providers:
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : [],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      if (
        !user.email ||
        !profile ||
        !("email_verified" in profile) ||
        !profile.email_verified
      )
        return false;
      const existing = await db.user.findUnique({
        where: { email: user.email },
      });
      return !existing?.suspended && !existing?.demoBatchId;
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      await db.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          ...(user.email && adminEmails.includes(user.email.toLowerCase())
            ? { role: "SUPERADMIN" }
            : {}),
        },
      });
    },
  },
};
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  return user && !user.suspended && !user.demoBatchId ? user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, "กรุณาเข้าสู่ระบบ");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) throw new AppError(403, "เฉพาะผู้ดูแลระบบ");
  return user;
}
