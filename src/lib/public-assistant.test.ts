// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import {
  PUBLIC_ASSISTANT_SUGGESTIONS,
  answerPublicQuestion,
} from "./public-assistant";

describe("KaSiHub public assistant", () => {
  it("answers only from the approved public overview", () => {
    const answer = answerPublicQuestion("What is KaSiHub?");

    expect(answer.topic).toBe("overview");
    expect(answer.source).toContain("KaSiHub public website");
    expect(answer.message).toContain("5×6");
  });

  it.each([
    ["What features are available?", "features"],
    ["How do I get started?", "getting-started"],
    ["Is Roots CO-OP Bank part of this?", "roots-bank"],
    ["Can I use this on WhatsApp?", "whatsapp"],
    ["How do I contact support?", "support"],
  ])("routes %s to %s", (question, topic) => {
    expect(answerPublicQuestion(question).topic).toBe(topic);
  });

  it.each([
    "Can you check my account?",
    "Why was my payment rejected?",
    "Am I eligible?",
    "Should I buy shares?",
    "My ID number is 123",
  ])("refuses restricted request: %s", (question) => {
    const answer = answerPublicQuestion(question);

    expect(answer.topic).toBe("restricted");
    expect(answer.message).toContain("cannot access accounts");
    expect(answer.message).toContain("support@kasihub.co.za");
  });

  it("uses a safe fallback instead of inventing an answer", () => {
    const answer = answerPublicQuestion("When will a new branch open?");

    expect(answer.topic).toBe("fallback");
    expect(answer.message).toContain("do not have an approved public");
  });

  it("uses exact KaSiHub product branding in every user-facing string", () => {
    const strings = [
      ...PUBLIC_ASSISTANT_SUGGESTIONS,
      ...[
        "overview",
        "features",
        "getting started",
        "roots bank",
        "WhatsApp",
        "support",
        "unknown question",
      ].map((question) => answerPublicQuestion(question).message),
    ];

    expect(strings.join("\n")).not.toMatch(/\b(?:KasaHub|KasiHub|KaSiHUB)\b/);
  });
});
