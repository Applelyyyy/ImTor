import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!["ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/profile");
  return user;
}
