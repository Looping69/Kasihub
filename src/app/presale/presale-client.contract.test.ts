import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("presale crypto payment copy", () => {
  test("uses compact mobile-safe verification actions", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain('"Start verification"');
    expect(source).toContain('"Saving hash…"');
    expect(source).toContain('>Open applicant account</Link>');
    expect(source).not.toContain('"Submit transaction for confirmation"');
  });

  test("keeps financial CTAs behind one parsed server authority snapshot", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("const authorityView = applicantAuthorityView(applicantAuthority)");
    expect(source).toContain('const canCreateReservation = authorityHydration === "loaded" && authorityView.canCreateReservation');
    expect(source).toContain("const reservation = authorityView.showReservation");
    expect(source).toContain('allowsApplicantAction(applicantAuthority, "submit_payment_hash")');
    expect(source).toContain('allowsApplicantAction(applicantAuthority, "start_card_checkout")');
  });

  test("enforces KIP-029 response ordering before accepting portal authority", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("setApplicantAuthority(authority)");
    expect(source).toContain("authorityFreshnessRef.current.begin()");
    expect(source).toContain("authorityFreshnessRef.current.isLatest(generation)");
  });
});
