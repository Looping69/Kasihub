// Author: Klaasvaakie ( |╲ )
export function allocateEvenCents(totalCents: number, profileIds: string[]): { profileId: string; cents: number }[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || profileIds.length === 0) throw new Error("invalid_allocation_input");
  const sorted = [...new Set(profileIds)].sort();
  const base = Math.floor(totalCents / sorted.length);
  const remainder = totalCents - base * sorted.length;
  return sorted.map((profileId, index) => ({ profileId, cents: base + (index < remainder ? 1 : 0) }));
}

export function allocateWeightedCents(totalCents: number, weighted: { profileId: string; weight: number }[]): { profileId: string; weight: number; cents: number }[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || weighted.length === 0) throw new Error("invalid_allocation_input");
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (!(totalWeight > 0) || weighted.some((item) => !(item.weight >= 0))) throw new Error("invalid_allocation_weight");
  const rows = weighted.map((item) => {
    const exact = totalCents * item.weight / totalWeight;
    return { ...item, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = totalCents - rows.reduce((sum, item) => sum + item.cents, 0);
  rows.sort((a, b) => b.fraction - a.fraction || a.profileId.localeCompare(b.profileId));
  for (let index = 0; index < rows.length && remainder > 0; index++, remainder--) rows[index].cents++;
  return rows.sort((a, b) => a.profileId.localeCompare(b.profileId)).map(({ profileId, weight, cents }) => ({ profileId, weight, cents }));
}
