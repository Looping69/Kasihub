import { describe, expect, test } from "vitest";
import { classifyObligationFunding } from "./settlement-policy";

describe("payment obligation funding", () => {
  test("accumulates multiple confirmed credits against one obligation", () => {
    expect(classifyObligationFunding("100.000000", ["80", "20"])).toMatchObject({
      status: "paid", dueUnits: 100000000n, creditedUnits: 100000000n,
    });
  });

  test.each([
    [[], "open"],
    [["20"], "partially_paid"],
    [["100.000001"], "review_required"],
  ] as const)("classifies %j as %s", (credits, status) => {
    expect(classifyObligationFunding("100", credits).status).toBe(status);
  });
});
