import { describe, expect, it } from "vitest";
import { faultPacket, safeRoute } from "./sentinel-core";

describe("Dev Sentinel privacy boundary", () => {
  it("keeps query names but redacts their values", () => {
    expect(safeRoute("https://example.test/api/presale/offer?invite=secret&memberId=123"))
      .toBe("/api/presale/offer?invite=REDACTED&memberId=REDACTED");
  });

  it("generates an AI packet without request or response bodies", () => {
    const fault = { id: "fault-1", timestamp: 1_700_000_000_000, severity: "error" as const, source: "api" as const, title: "API 500", message: "POST /api/shares", requestId: "req-1", metadata: { status: 500 } };
    const packet = faultPacket(fault, [fault]);
    expect(packet.fault.requestId).toBe("req-1");
    expect(packet.fault.metadata).toEqual({ status: 500 });
    expect(packet.fault).not.toHaveProperty("requestBody");
    expect(packet.fault).not.toHaveProperty("responseBody");
    expect(packet.privacy).toContain("intentionally excluded");
  });
});
