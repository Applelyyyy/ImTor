import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: execute } }));
import { transaction } from "@/services/transactions";
const error = (code: string, sqlState?: string) => new Prisma.PrismaClientKnownRequestError("database failure", { code, clientVersion: "test", ...(sqlState ? { meta: { code: sqlState } } : {}) });
describe("bounded transaction retry discriminants", () => {
  beforeEach(() => { execute.mockReset(); });
  it.each([["P2034", undefined], ["P2010", "40001"], ["P2010", "40P01"]])("retries only PostgreSQL serialization/deadlock failures %s/%s", async (code, state) => {
    execute.mockRejectedValueOnce(error(code!, state)).mockResolvedValueOnce("committed");
    expect(await transaction(async () => "ignored")).toBe("committed");
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it.each([["P2010", "23505"], ["P2010", undefined], ["P2002", undefined]])("does not retry unrelated failures %s/%s", async (code, state) => {
    const failure = error(code!, state);
    execute.mockRejectedValue(failure);
    await expect(transaction(async () => undefined)).rejects.toBe(failure);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it.each(["40001", "40P01"])("retries the actual Prisma7 driver-adapter SQLSTATE shape %s", async (state) => {
    const failure = new Prisma.PrismaClientKnownRequestError("adapter conflict", { code: "P2010", clientVersion: "test", meta: { driverAdapterError: { cause: { kind: "TransactionWriteConflict", originalCode: state } } } });
    execute.mockRejectedValueOnce(failure).mockResolvedValueOnce("committed");
    expect(await transaction(async () => "ignored")).toBe("committed");
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("does not retry unrelated nested driver-adapter errors", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError("adapter conflict", { code: "P2010", clientVersion: "test", meta: { driverAdapterError: { cause: { originalCode: "23505" } } } });
    execute.mockRejectedValue(failure);
    await expect(transaction(async () => undefined)).rejects.toBe(failure);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("stops after the existing three retries", async () => {
    execute.mockRejectedValue(error("P2010", "40001"));
    await expect(transaction(async () => undefined)).rejects.toThrow("database failure");
    expect(execute).toHaveBeenCalledTimes(4);
  });
});
