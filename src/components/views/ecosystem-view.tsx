"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Network, Users, ChevronUp, Crown, Loader2, Info, UserCircle2,
  Building2, User, GitBranch,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKasiStore } from "@/lib/store";

interface MatrixData {
  tree: TreeNode | null;
  levelStats: { level: number; count: number; maxCount: number; commission: number }[];
  upline: { level: number; profileNumber: string; firstName: string | null; lastName: string | null; companyName: string | null }[];
  myLevel: number;
  myNodeIndex: number;
}

interface TreeNode {
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
}

export function EcosystemView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusLevel, setFocusLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!currentMember) return;
    async function load() {
      try {
        const res = await fetch(`/api/matrix?memberId=${currentMember!.id}`, { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentMember]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCommission = data.levelStats.reduce((s, l) => s + l.commission, 0);
  const totalDownline = data.levelStats.reduce((s, l) => s + l.count, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Network className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-black tracking-tight">5 × 6 Forced Ecosystem</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your position is <span className="font-mono font-semibold">#{data.myNodeIndex}</span> at level {data.myLevel}. The matrix fills top-left to bottom-right — no recruitment required to earn.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Your downline</p>
          <p className="text-2xl font-black mt-1">{totalDownline}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Monthly commission</p>
          <p className="text-2xl font-black mt-1 text-emerald-600">R {totalCommission.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Levels filled</p>
          <p className="text-2xl font-black mt-1">{data.levelStats.filter((l) => l.count > 0).length} / 6</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Upline chain</p>
          <p className="text-2xl font-black mt-1">{data.upline.length}</p>
        </Card>
      </div>

      {/* Upline */}
      {data.upline.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ChevronUp className="h-4 w-4 text-amber-600" />
            <h3 className="font-bold text-sm">Your upline</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.upline.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60">
                  <span className="text-[10px] text-muted-foreground">L{u.level}</span>
                  <span className="text-xs font-medium">{u.companyName || `${u.firstName} ${u.lastName}`}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{u.profileNumber}</span>
                </div>
                {i < data.upline.length - 1 && <ChevronUp className="h-3 w-3 text-muted-foreground rotate-90" />}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Level table */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Level breakdown</h3>
            <p className="text-xs text-muted-foreground">R47 of each R140 subscription is paid up 6 levels</p>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <GitBranch className="h-3 w-3 mr-1" /> No recruit required
          </Badge>
        </div>
        <div className="space-y-2">
          {data.levelStats.map((l) => {
            const pct = (l.count / l.maxCount) * 100;
            const isActive = focusLevel === l.level;
            return (
              <button
                key={l.level}
                onClick={() => setFocusLevel(isActive ? null : l.level)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  isActive ? "bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-300" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                      {l.level}
                    </span>
                    <span className="font-semibold text-sm">Level {l.level}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.count} / {l.maxCount} filled
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">R{l.commission.toFixed(0)}/mo</span>
                    <span className="font-bold text-emerald-600">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
              </button>
            );
          })}
        </div>
      </Card>

      {/* Matrix tree visualization */}
      <Card className="p-5 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Matrix tree</h3>
            <p className="text-xs text-muted-foreground">Up to 6 levels deep, 5 wide per node</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500" />
              <span className="text-muted-foreground">You</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              <span className="text-muted-foreground">Empty spot</span>
            </div>
          </div>
        </div>

        <TooltipProvider>
          <div className="min-w-[800px]">
            {data.tree && <MatrixRow node={data.tree} focusLevel={focusLevel} />}
          </div>
        </TooltipProvider>
      </Card>

      {/* Info card */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">How the 5 × 6 matrix works</p>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
              <li>The matrix has 6 levels. Each node has up to 5 direct children — total 19,530 spots.</li>
              <li>New members are placed in the <strong>first open spot</strong>, filling top-left to bottom-right.</li>
              <li>R47 of every R140 subscription is distributed up 6 levels. You earn from your entire downline.</li>
              <li><strong>No recruitment is required</strong> to earn from the matrix. Spillover from upline fills your downline.</li>
              <li>Once you earn more than R7,000/month, 25% tax is deducted and an IRP5 is issued at year-end.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MatrixRow({ node, focusLevel, level = 0 }: { node: TreeNode; focusLevel: number | null; level?: number }) {
  if (level > 5) return null;
  const dim = focusLevel !== null && level > focusLevel;
  return (
    <div className={`flex flex-col items-center transition-opacity ${dim ? "opacity-30" : ""}`}>
      <MatrixNode node={node} />
      {node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-2 sm:gap-3">
            {Array.from({ length: 5 }).map((_, i) => {
              const child = node.children[i];
              return child ? (
                <MatrixRow key={child.id} node={child} focusLevel={focusLevel} level={level + 1} />
              ) : (
                <EmptySpot key={i} level={level + 1} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MatrixNode({ node }: { node: TreeNode }) {
  const Icon = node.member.membershipType === "COMPANY" ? Building2 : node.isMe ? Crown : User;
  const name = node.member.companyName || `${node.member.firstName || ""} ${node.member.lastName || ""}`.trim() || "Member";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={`relative flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-0.5 ${
            node.isMe
              ? "border-amber-400 bg-gradient-to-br from-emerald-500 to-amber-500 text-white shadow-lg shadow-emerald-500/30"
              : "border-emerald-200 dark:border-emerald-900 bg-card hover:border-emerald-400"
          }`}
        >
          <Icon className={`h-5 w-5 mb-0.5 ${node.isMe ? "text-white" : "text-emerald-600"}`} />
          <p className={`text-[9px] font-medium text-center px-1 leading-tight truncate max-w-full ${node.isMe ? "text-white" : "text-foreground"}`}>
            {name.split(" ")[0]}
          </p>
          <p className={`text-[8px] font-mono ${node.isMe ? "text-white/80" : "text-muted-foreground"}`}>
            {node.member.profileNumber}
          </p>
          {node.member.subscriptionStatus === "LAPSED" && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-background" />
          )}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-semibold">{name}</p>
          <p className="text-muted-foreground">{node.member.profileNumber}</p>
          <p className="text-muted-foreground">{node.member.membershipType.replace(/_/g, " ")} · {node.member.country}</p>
          <p className="text-muted-foreground">Status: {node.member.subscriptionStatus}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptySpot({ level }: { level: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground/40">
          <UserCircle2 className="h-5 w-5" />
          <p className="text-[8px] mt-0.5">Open · L{level}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Open position at level {level}</p>
        <p className="text-muted-foreground text-[10px]">Next member will be placed here</p>
      </TooltipContent>
    </Tooltip>
  );
}
