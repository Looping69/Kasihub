// Author: Klaasvaakie ( |╲ )

export type PublicAssistantTopic =
  | "overview"
  | "features"
  | "getting-started"
  | "roots-bank"
  | "whatsapp"
  | "support"
  | "restricted"
  | "fallback";

export interface PublicAssistantAnswer {
  topic: PublicAssistantTopic;
  message: string;
  source?: string;
}

export const PUBLIC_ASSISTANT_SUGGESTIONS = [
  "What is KaSiHub?",
  "What features are available?",
  "How do I get started?",
  "How do I contact support?",
] as const;

const PUBLIC_SOURCE = "KaSiHub public website";
const SUPPORT_EMAIL = "support@kasihub.co.za";

const RESTRICTED_ANSWER: PublicAssistantAnswer = {
  topic: "restricted",
  message:
    `I can only explain public KaSiHub information. I cannot access accounts, handle payments, give financial advice, decide eligibility, or collect personal information. Please do not share passwords, ID numbers, banking details, or other personal data here. Contact ${SUPPORT_EMAIL} for safe assistance.`,
  source: "KaSiHub public support boundary",
};

const ANSWERS: Record<
  Exclude<PublicAssistantTopic, "restricted" | "fallback">,
  PublicAssistantAnswer
> = {
  overview: {
    topic: "overview",
    message:
      "KaSiHub is the central point of a hybrid ecosystem connecting members with its 5×6 Eco-System, KasiShares, KasiMarketPlace, KasiMall, and the separate Roots CO-OP Bank entity.",
    source: `${PUBLIC_SOURCE} — About and Ecosystem`,
  },
  features: {
    topic: "features",
    message:
      "The public KaSiHub website presents five ecosystem areas: KaSiHub membership and the 5×6 Eco-System, Roots CO-OP Bank, KasiShares, KasiMarketPlace, and KasiMall. Availability and participation can depend on the relevant onboarding, membership, or product requirements.",
    source: `${PUBLIC_SOURCE} — The 5 Pillars`,
  },
  "getting-started": {
    topic: "getting-started",
    message:
      "Use “Join KaSiHub” on this website, choose the relevant membership type, and follow the registration and identity-verification steps shown there. The website then guides eligible, completed registrations toward their profile and ecosystem access. For help with a real application, contact support without posting personal details here.",
    source: `${PUBLIC_SOURCE} — How it works`,
  },
  "roots-bank": {
    topic: "roots-bank",
    message:
      "The public website presents Roots CO-OP Bank as a connected ecosystem pillar and explicitly states that it is a separate entity from KaSiHub. I can explain that public distinction, but I cannot advise on shares, eligibility, payments, or financial decisions.",
    source: `${PUBLIC_SOURCE} — Roots Bank Pioneers`,
  },
  whatsapp: {
    topic: "whatsapp",
    message:
      "This release is website-only. KaSiHub has deliberately not connected this assistant to WhatsApp; WhatsApp support remains with the owner’s existing third-party provider.",
    source: "KaSiHub assistant release scope",
  },
  support: {
    topic: "support",
    message:
      `For account-specific questions, applications, payments, eligibility, or anything involving personal information, email ${SUPPORT_EMAIL}. Do not include passwords, one-time codes, full ID numbers, or banking credentials.`,
    source: `${PUBLIC_SOURCE} — Get in touch`,
  },
};

const RESTRICTED_PATTERNS = [
  /\b(my|our)\s+(account|application|profile|membership|payment|transaction|balance|shares?)\b/i,
  /\b(account|login|password|one[- ]?time code|otp|refund|payment|transaction|deposit|withdraw|banking details?)\b/i,
  /\b(eligible|eligibility|qualify|approved|approval|rejected|kyc status)\b/i,
  /\b(financial advice|investment advice|should i (buy|invest)|guaranteed return|profit guarantee)\b/i,
  /\b(id number|passport number|bank account|card number|personal data|personal information)\b/i,
];

function includesAny(input: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => input.includes(phrase));
}

export function answerPublicQuestion(question: string): PublicAssistantAnswer {
  const normalized = question.trim().toLocaleLowerCase("en-ZA");

  if (!normalized) {
    return {
      topic: "fallback",
      message:
        "Ask me a public question about KaSiHub, its features, getting started, or common website information.",
    };
  }

  if (RESTRICTED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return RESTRICTED_ANSWER;
  }

  if (includesAny(normalized, ["support", "contact", "help desk", "email", "human"])) {
    return ANSWERS.support;
  }

  if (includesAny(normalized, ["whatsapp", "wa blast", "wablast"])) {
    return ANSWERS.whatsapp;
  }

  if (includesAny(normalized, ["roots", "co-op bank", "coop bank", "pioneer"])) {
    return ANSWERS["roots-bank"];
  }

  if (
    includesAny(normalized, [
      "get started",
      "getting started",
      "join",
      "onboard",
      "onboarding",
      "register",
      "sign up",
      "how it works",
    ])
  ) {
    return ANSWERS["getting-started"];
  }

  if (
    includesAny(normalized, [
      "feature",
      "ecosystem",
      "pillar",
      "kasishares",
      "marketplace",
      "kasi mall",
      "kasimall",
      "5×6",
      "5x6",
    ])
  ) {
    return ANSWERS.features;
  }

  if (
    includesAny(normalized, [
      "what is",
      "who is",
      "about",
      "explain",
      "tell me",
      "kasihub",
    ])
  ) {
    return ANSWERS.overview;
  }

  return {
    topic: "fallback",
    message:
      `I do not have an approved public KaSiHub answer for that. Try asking what KaSiHub is, what features the website presents, or how to get started. For anything else, contact ${SUPPORT_EMAIL}.`,
    source: "KaSiHub approved-answer fallback",
  };
}
