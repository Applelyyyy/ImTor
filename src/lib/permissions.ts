import { invariant } from "./errors";
export type Actor = { id: string; role: string; suspended: boolean };
export function isAdmin(actor: Actor) {
  return !actor.suspended && ["ADMIN", "SUPERADMIN"].includes(actor.role);
}
export function assertActive(actor: Actor) {
  invariant(!actor.suspended, "บัญชีถูกระงับ", 403);
}
export function assertOwner(actor: Actor, store: { ownerId: string }) {
  assertActive(actor);
  invariant(
    store.ownerId === actor.id || isAdmin(actor),
    "ไม่มีสิทธิ์จัดการร้านนี้",
    403,
  );
}
export function assertAdmin(actor: Actor) {
  invariant(isAdmin(actor), "เฉพาะผู้ดูแลระบบ", 403);
}
