import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/matrix?memberId=xxx - get matrix structure from the member's perspective
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const myNode = await db.matrixNode.findUnique({
      where: { memberId },
      include: { member: true },
    });
    if (!myNode) {
      return NextResponse.json({ error: "Member not in matrix" }, { status: 404 });
    }

    // Fetch all nodes (with members) - we need to build the downline tree
    const allNodes = await db.matrixNode.findMany({
      include: {
        member: {
          select: {
            id: true,
            profileNumber: true,
            firstName: true,
            lastName: true,
            companyName: true,
            membershipType: true,
            country: true,
            subscriptionStatus: true,
          },
        },
      },
      orderBy: { nodeIndex: "asc" },
    });

    // Build child map
    const childMap = new Map<string, typeof allNodes>();
    for (const n of allNodes) {
      if (n.parentId) {
        const arr = childMap.get(n.parentId) || [];
        arr.push(n);
        childMap.set(n.parentId, arr);
      }
    }

    // BFS to build the 5x6 tree (6 levels deep, 5 wide)
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

    function buildTree(nodeId: string, level: number, position: number, depth: number): TreeNode | null {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const isMe = node.memberId === memberId;
      const children: TreeNode[] = [];
      if (depth < 6) {
        const kids = childMap.get(nodeId) || [];
        // sort by position
        kids.sort((a, b) => a.position - b.position);
        for (let i = 0; i < 5; i++) {
          const kid = kids[i];
          if (kid) {
            const child = buildTree(kid.id, level + 1, i, depth + 1);
            if (child) children.push(child);
          }
        }
      }
      return {
        id: node.memberId,
        nodeId: node.id,
        level,
        position,
        isMe,
        member: {
          profileNumber: node.member.profileNumber,
          firstName: node.member.firstName,
          lastName: node.member.lastName,
          companyName: node.member.companyName,
          membershipType: node.member.membershipType,
          country: node.member.country,
          subscriptionStatus: node.member.subscriptionStatus,
        },
        children,
      };
    }

    const tree = buildTree(myNode.id, 0, 0, 0);

    // Stats per level
    const levelStats: { level: number; count: number; maxCount: number; commission: number }[] = [];
    // Commission per level (R47 of each payment distributed up 6 levels)
    // Level 1 gets the most, decreasing. The spec says R47 paid up 6 levels.
    // We'll use a reasonable distribution: L1=R20, L2=R10, L3=R8, L4=R5, L5=R3, L6=R1
    const commissionPerLevel = [20, 10, 8, 5, 3, 1];

    function countAtLevel(node: TreeNode | null, targetLevel: number, currentLevel: number = 0): number {
      if (!node) return 0;
      if (currentLevel === targetLevel) return 1;
      let count = 0;
      for (const c of node.children) {
        count += countAtLevel(c, targetLevel, currentLevel + 1);
      }
      return count;
    }

    for (let l = 1; l <= 6; l++) {
      const count = countAtLevel(tree, l);
      const maxCount = Math.pow(5, l);
      levelStats.push({
        level: l,
        count,
        maxCount,
        commission: count * commissionPerLevel[l - 1],
      });
    }

    // Upline chain
    const upline: typeof allNodes = [];
    let cur = myNode.parentId;
    while (cur) {
      const n = allNodes.find((x) => x.id === cur);
      if (!n) break;
      upline.push(n);
      cur = n.parentId;
      if (upline.length >= 6) break;
    }

    return NextResponse.json({
      tree,
      levelStats,
      upline: upline.map((n) => ({
        level: n.level,
        profileNumber: n.member.profileNumber,
        firstName: n.member.firstName,
        lastName: n.member.lastName,
        companyName: n.member.companyName,
      })),
      myLevel: myNode.level,
      myNodeIndex: myNode.nodeIndex,
    });
  } catch (error) {
    console.error("[matrix] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
