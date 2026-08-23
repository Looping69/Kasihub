// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { identityDb, networkDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess } from "../auth/access";
import { placeMatrixNode } from "./placement";

interface MatrixNodeResponse {
  id: string;
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
}

interface MatrixTreeNode {
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
}

export const myMatrix = api<
  { profileId: string },
  { node: MatrixNodeResponse | null }
>(
  { method: "GET", path: "/matrix/me/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const row = await networkDb.rawQueryRow<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes WHERE profile_id = $1", req.profileId);
    return {
      node: row
        ? {
            id: row.id,
            profileId: row.profile_id,
            parentNodeId: row.parent_node_id,
            sponsorProfileId: row.sponsor_profile_id,
            positionIndex: row.position_index,
            depth: row.depth,
            path: row.path,
          }
        : null,
    };
  },
);

export const memberDownline = api<
  { profileId: string },
  { nodes: MatrixNodeResponse[] }
>(
  { method: "GET", path: "/matrix/me/:profileId/downline", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const root = await networkDb.rawQueryRow<{ path: string }>(
      "SELECT path FROM matrix_nodes WHERE profile_id = $1",
      req.profileId,
    );
    if (!root) return { nodes: [] };
    const rows = await networkDb.rawQueryAll<{
      id: string;
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>(
      `SELECT id, profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path
       FROM matrix_nodes
       WHERE path = $1 OR path LIKE $1 || '.%'
       ORDER BY depth, position_index`,
      root.path,
    );
    return {
      nodes: rows.map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        parentNodeId: row.parent_node_id,
        sponsorProfileId: row.sponsor_profile_id,
        positionIndex: row.position_index,
        depth: row.depth,
        path: row.path,
      })),
    };
  },
);

export const matrixTree = api<
  void,
  { nodes: MatrixTreeNode[] }
>(
  { method: "GET", path: "/admin/matrix/tree", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await networkDb.rawQueryAll<{
      profile_id: string;
      parent_node_id: string | null;
      sponsor_profile_id: string | null;
      position_index: number;
      depth: number;
      path: string;
    }>("SELECT profile_id, parent_node_id, sponsor_profile_id, position_index, depth, path FROM matrix_nodes ORDER BY depth, position_index",
    );
    return {
      nodes: rows.map((row) => ({
        profileId: row.profile_id,
        parentNodeId: row.parent_node_id,
        sponsorProfileId: row.sponsor_profile_id,
        positionIndex: row.position_index,
        depth: row.depth,
        path: row.path,
      })),
    };
  },
);




