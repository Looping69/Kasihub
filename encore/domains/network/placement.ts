// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import { networkDb } from "../../resources";

export interface MatrixPlacement {
  id: string;
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
}

export async function placeMatrixNode(profileId: string, sponsorProfileId: string | null): Promise<MatrixPlacement> {
  const tx = await networkDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext('kasihub-matrix-placement'))");
    const existing = await tx.rawQueryRow<{
      id: string; profile_id: string; parent_node_id: string | null; sponsor_profile_id: string | null;
      position_index: number; depth: number; path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", profileId);
    if (existing) {
      await tx.commit();
      return { id: existing.id, profileId: existing.profile_id, parentNodeId: existing.parent_node_id,
        sponsorProfileId: existing.sponsor_profile_id, positionIndex: existing.position_index, depth: existing.depth, path: existing.path };
    }
    const count = await tx.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM matrix_nodes");
    const parent = Number(count?.count ?? 0) === 0 ? null : await tx.rawQueryRow<{
      id: string; depth: number; path: string; child_count: number;
    }>(`SELECT n.id, n.depth, n.path, COUNT(c.id)::int AS child_count
        FROM matrix_nodes n LEFT JOIN matrix_nodes c ON c.parent_node_id = n.id
        WHERE n.depth < 5
        GROUP BY n.id, n.depth, n.path, n.profile_id, n.created_at
        HAVING COUNT(c.id) < 5
        ORDER BY CASE WHEN n.profile_id = $1 THEN 0 ELSE 1 END, n.depth, n.path, n.created_at
        LIMIT 1`, sponsorProfileId);
    if (Number(count?.count ?? 0) > 0 && !parent) throw APIError.resourceExhausted("The current 5x6 ecosystem is full");
    const nodeId = crypto.randomUUID();
    const depth = parent ? parent.depth + 1 : 0;
    const positionIndex = parent?.child_count ?? 0;
    const path = parent ? `${parent.path}.${positionIndex}` : "0";
    await tx.rawExec(`INSERT INTO matrix_nodes
      (id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      nodeId, profileId, parent?.id ?? null, sponsorProfileId, positionIndex, depth, path);
    await tx.commit();
    return { id: nodeId, profileId, parentNodeId: parent?.id ?? null, sponsorProfileId, positionIndex, depth, path };
  } catch (error) { await tx.rollback(); throw error; }
}
