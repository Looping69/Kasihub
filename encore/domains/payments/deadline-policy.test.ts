import { describe, expect, test } from "vitest";
import { classifyTransactionDeadline } from "./deadline-policy";

describe("canonical transaction deadline policy", () => {
  const deadline = "2026-09-02T12:00:00.000Z";
  test("accepts a transaction mined before deadline even when verified later", () => {
    expect(classifyTransactionDeadline("2026-09-02T11:59:59.000Z", deadline)).toBe("on_time");
  });
  test("routes a transaction mined after deadline as late", () => {
    expect(classifyTransactionDeadline("2026-09-02T12:00:01.000Z", deadline)).toBe("late");
  });
  test("uses mining time when proof is submitted after deadline", () => {
    expect(classifyTransactionDeadline("2026-09-02T11:45:00.000Z", deadline)).toBe("on_time");
  });
  test("fails closed when an RPC outage leaves block time unavailable", () => {
    expect(classifyTransactionDeadline(null, deadline)).toBe("manual_review");
  });
});
