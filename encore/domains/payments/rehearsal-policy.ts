// Author: Klaasvaakie ( |╲ )

/** Pure fail-closed policy kept separate from Encore runtime for testability. */
export function isPaymentRehearsalAllowed(isMock: boolean, environmentType: string): boolean {
  return isMock && environmentType !== "production";
}
