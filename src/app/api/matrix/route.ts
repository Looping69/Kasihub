// Author: Klaasvaakie ( |╲ )
import { NextRequest, NextResponse } from "next/server";
import { EncoreRequestError, encoreRequest, encoreSessionToken } from "@/lib/encore-client";

type MatrixNode = {
  id: string;
  profileId: string;
  parentNodeId: string | null;
  sponsorProfileId: string | null;
  positionIndex: number;
  depth: number;
  path: string;
};

type TreeNode = {
  id: string;
  nodeId: string;
  level: number;
  position: number;
  isMe: boolean;
  member: {
    profileNumber: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    membershipType: string;
    country: string;
    subscriptionStatus: string;
  };
  children: TreeNode[];
};

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("memberId");
  const token = await encoreSessionToken();
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { nodes } = await encoreRequest<{ nodes: MatrixNode[] }>(
      `/matrix/me/${encodeURIComponent(memberId)}/downline`,
      {},
      token,
    );
    const root = nodes.find((node) => node.profileId === memberId);
    if (!root) return NextResponse.json({ error: "Member not in matrix" }, { status: 404 });
    const childMap = new Map<string, MatrixNode[]>();
    for (const node of nodes) {
      if (!node.parentNodeId) continue;
      const children = childMap.get(node.parentNodeId) ?? [];
      children.push(node);
      childMap.set(node.parentNodeId, children);
    }
    const buildTree = (node: MatrixNode): TreeNode => ({
      id: node.profileId,
      nodeId: node.id,
      level: node.depth - root.depth,
      position: node.positionIndex,
      isMe: node.profileId === memberId,
      member: {
        profileNumber: `KSI-${node.profileId.slice(0, 8).toUpperCase()}`,
        firstName: node.profileId === memberId ? "You" : "Member",
        lastName: null,
        companyName: null,
        membershipType: "MEMBER",
        country: "ZA",
        subscriptionStatus: "ACTIVE",
      },
      children: (childMap.get(node.id) ?? [])
        .sort((left, right) => left.positionIndex - right.positionIndex)
        .slice(0, 5)
        .map(buildTree),
    });
    const commissionPerLevel = [20, 10, 8, 5, 3, 1];
    const levelStats = commissionPerLevel.map((rate, index) => {
      const level = index + 1;
      const count = nodes.filter((node) => node.depth - root.depth === level).length;
      return { level, count, maxCount: 5 ** level, commission: count * rate };
    });
    return NextResponse.json({
      tree: buildTree(root),
      levelStats,
      upline: [],
      myLevel: root.depth,
      myNodeIndex: root.positionIndex,
    });
  } catch (error) {
    const status = error instanceof EncoreRequestError ? error.status : 500;
    return NextResponse.json({ error: "Unable to load matrix from Encore" }, { status });
  }
}
