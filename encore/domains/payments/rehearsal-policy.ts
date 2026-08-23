// Author: Klaasvaakie ( |╲ )

/** Pure fail-closed policy kept separate from Encore runtime for testability. */
export function isPaymentRehearsalAllowed(isMock: boolean, environmentName: string): boolean {
  if (!isMock) return false;
  const normalized = environmentName.trim().toLowerCase();
  return normalized === "local"
    || normalized === "test"
    || normalized === "staging"
    || normalized.startsWith("staging-")
    || normalized.endsWith("-staging");
}
