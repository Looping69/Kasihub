// Invitation allocations are the per-investor authority; campaigns supply the global inventory boundary.
// Author: Klaasvaakie ( |╲ )
export function exceedsInvitationShareLimit(usedShares: number, requestedShares: number, maximumShares: number): boolean {
  return usedShares + requestedShares > maximumShares;
}
