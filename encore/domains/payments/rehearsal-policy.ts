// Author: Klaasvaakie ( |╲ )

/** Pure fail-closed policy kept separate from Encore runtime for testability. */
const REHEARSAL_ENVIRONMENTS = new Set(["staging", "local", "test"]);

export function isPaymentRehearsalAllowed(isMock: boolean, environmentName: string): boolean {
  return isMock && REHEARSAL_ENVIRONMENTS.has(environmentName);
}
