import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CryptoVerificationProgress } from "./crypto-verification-progress";

describe("payment evidence labels", () => {
  it("does not mark blockchain checks verified during a chain provider outage", () => {
    const html = renderToStaticMarkup(<CryptoVerificationProgress journeyState="payment_submitted" transactionHash="0x123" verificationReason="chain_provider_unavailable" />);
    expect(html).not.toContain("Receiver, token, amount and depth verified");
    expect(html).not.toContain("Blockchain checks passed;");
  });

  it("separates custody recovery from verified settlement", () => {
    const html = renderToStaticMarkup(<CryptoVerificationProgress journeyState="payment_submitted" transactionHash="0x123" verificationReason="custody_temporarily_unavailable" />);
    expect(html).toContain("Blockchain checks passed;");
    expect(html).not.toContain("Custodian credit matched to this transfer");
    expect(html).not.toContain("Shares issued and certificate available");
  });
});
