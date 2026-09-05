import { paymentsDb } from "../../resources";
import { classifyObligationFunding } from "./settlement-policy";
import { unitsToDecimal } from "./chains/amount";

/** Only verified, deduplicated credits are exposed as money received. */
export async function readObligationFunding(obligationId: string, due: string) {
  const credits = await paymentsDb.rawQueryAll<{ amount: string }>(
    "SELECT amount::text AS amount FROM payment_credits WHERE obligation_id=$1 AND status='confirmed'",
    obligationId,
  );
  const funding = classifyObligationFunding(due, credits.map((credit) => credit.amount));
  return {
    receivedUsdt: unitsToDecimal(funding.creditedUnits, 6),
    outstandingUsdt: unitsToDecimal(funding.dueUnits > funding.creditedUnits ? funding.dueUnits - funding.creditedUnits : 0n, 6),
  };
}
