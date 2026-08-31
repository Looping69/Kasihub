import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync("src/components/views/shares-view.tsx", "utf8");

describe("SharesView failure and authority contract", () => {
  test("renders a bounded failure state with a retry instead of an endless spinner", () => {
    expect(source).toContain("const [error, setError]");
    expect(source).toContain("Your shares could not be loaded");
    expect(source).toContain("Retry portfolio");
    expect(source).not.toContain("if (loading || !data)");
  });

  test("does not render placeholder payout or Aureus values as authoritative holdings", () => {
    expect(source).toContain("data.profitShareAvailable ?");
    expect(source).toContain("No payout is estimated from placeholder data");
    expect(source).toContain("(aureusActiveCount > 0 || aureusRetractedCount > 0)");
  });

  test("uses session-derived ownership and historical acquisition terminology", () => {
    expect(source).toContain('fetch("/api/member/shares"');
    expect(source).not.toContain("memberId=");
    expect(source).toContain("Historical acquisition cost");
    expect(source).toContain("Average paid issue price");
    expect(source).toContain("Purchase amount");
    expect(source).not.toContain('["Current value"');
    expect(source).not.toContain("actual value");
  });

  test("prints issued presale certificates through the sealed PDF route", () => {
    expect(source).toContain("/api/shares/certificates/");
    expect(source).toContain("Open the holder-authorised PDF generated from the sealed ledger snapshot");
  });
});
