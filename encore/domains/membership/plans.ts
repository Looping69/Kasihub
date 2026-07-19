// Author: Klaasvaakie ( |╲ )
import { membershipDb } from "../../infrastructure/resources";

const DEFAULT_PLANS: Record<string, { name: string; memberType: string; currency: string; amount: string }> = {
  INDIVIDUAL_LOCAL: { name: "Individual Local", memberType: "individual", currency: "ZAR", amount: "140.00" },
  INDIVIDUAL_INTERNATIONAL: { name: "Individual International", memberType: "individual", currency: "USD", amount: "20.00" },
  COMPANY_LOCAL: { name: "Company Local", memberType: "company", currency: "ZAR", amount: "300.00" },
  COMPANY_INTERNATIONAL: { name: "Company International", memberType: "company", currency: "USD", amount: "50.00" },
};

export async function ensureMembershipPlan(code: string) {
  const plan = DEFAULT_PLANS[code] ?? DEFAULT_PLANS.INDIVIDUAL_LOCAL;
  const existing = await membershipDb.rawQueryRow<{ id: string; code: string; amount: string; currency: string }>(
    "SELECT id, code, amount::text AS amount, currency FROM membership_plans WHERE code = $1", code);
  if (existing) return existing;
  const id = crypto.randomUUID();
  try {
    await membershipDb.rawExec(`INSERT INTO membership_plans
      (id, code, name, member_type, currency, amount, billing_period, active)
      VALUES ($1, $2, $3, $4, $5, $6::numeric, 'monthly', true)`,
      id, code, plan.name, plan.memberType, plan.currency, plan.amount);
  } catch {
    const raced = await membershipDb.rawQueryRow<{ id: string; code: string; amount: string; currency: string }>(
      "SELECT id, code, amount::text AS amount, currency FROM membership_plans WHERE code = $1", code);
    if (raced) return raced;
    throw new Error("membership_plan_not_created");
  }
  return { id, code, amount: plan.amount, currency: plan.currency };
}
