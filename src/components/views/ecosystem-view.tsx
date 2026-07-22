"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Network, Users, Loader2, Info, UserCircle2,
  Building2, User, Crown, Wallet, Calendar, TrendingUp, GitFork,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKasiStore } from "@/lib/store";

interface MatrixData {
  placementStatus?: "active" | "pending";
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

interface DashboardEarnings {
  earningsToday: number;
  earningsThisWeek: number;
  earningsThisMonth: number;
}

interface LevelColor {
  name: string;
  text: string;
  textStrong: string;
  bg: string;
  gradientFrom: string;
  gradientTo: string;
  border: string;
  hoverBorder: string;
  softBg: string;
  ring: string;
  swatch: string;
  oklch: string;
}

// Level 1 — Emerald, 2 — Teal, 3 — Amber, 4 — Orange, 5 — Rose, 6 — Violet
const LEVEL_COLORS: LevelColor[] = [
  {
    name: "emerald",
    text: "text-emerald-600",
    textStrong: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-emerald-600",
    border: "border-emerald-200 dark:border-emerald-900",
    hoverBorder: "hover:border-emerald-400",
    softBg: "bg-emerald-50 dark:bg-emerald-950/30",
    ring: "ring-emerald-300",
    swatch: "bg-emerald-500",
    oklch: "oklch(0.52 0.13 158)",
  },
  {
    name: "teal",
    text: "text-teal-600",
    textStrong: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-500",
    gradientFrom: "from-teal-500",
    gradientTo: "to-teal-600",
    border: "border-teal-200 dark:border-teal-900",
    hoverBorder: "hover:border-teal-400",
    softBg: "bg-teal-50 dark:bg-teal-950/30",
    ring: "ring-teal-300",
    swatch: "bg-teal-500",
    oklch: "oklch(0.65 0.18 145)",
  },
  {
    name: "amber",
    text: "text-amber-600",
    textStrong: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500",
    gradientFrom: "from-amber-500",
    gradientTo: "to-amber-600",
    border: "border-amber-200 dark:border-amber-900",
    hoverBorder: "hover:border-amber-400",
    softBg: "bg-amber-50 dark:bg-amber-950/30",
    ring: "ring-amber-300",
    swatch: "bg-amber-500",
    oklch: "oklch(0.75 0.15 80)",
  },
  {
    name: "orange",
    text: "text-orange-600",
    textStrong: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-500",
    gradientFrom: "from-orange-500",
    gradientTo: "to-orange-600",
    border: "border-orange-200 dark:border-orange-900",
    hoverBorder: "hover:border-orange-400",
    softBg: "bg-orange-50 dark:bg-orange-950/30",
    ring: "ring-orange-300",
    swatch: "bg-orange-500",
    oklch: "oklch(0.65 0.2 55)",
  },
  {
    name: "rose",
    text: "text-rose-600",
    textStrong: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-500",
    gradientFrom: "from-rose-500",
    gradientTo: "to-rose-600",
    border: "border-rose-200 dark:border-rose-900",
    hoverBorder: "hover:border-rose-400",
    softBg: "bg-rose-50 dark:bg-rose-950/30",
    ring: "ring-rose-300",
    swatch: "bg-rose-500",
    oklch: "oklch(0.6 0.2 15)",
  },
  {
    name: "violet",
    text: "text-violet-600",
    textStrong: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-500",
    gradientFrom: "from-violet-500",
    gradientTo: "to-violet-600",
    border: "border-violet-200 dark:border-violet-900",
    hoverBorder: "hover:border-violet-400",
    softBg: "bg-violet-50 dark:bg-violet-950/30",
    ring: "ring-violet-300",
    swatch: "bg-violet-500",
    oklch: "oklch(0.5 0.2 300)",
  },
];

// Tree levels: root (0) and 1 both map to Emerald (idx 0); 2..6 map to idx 1..5.
// Table levels: 1..6 map to idx 0..5 directly.
function colorForLevel(level: number): LevelColor {
  const idx = Math.max(0, Math.min(5, level - 1));
  return LEVEL_COLORS[idx];
}

function formatZAR(n: number) {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EcosystemView() {
  const { currentMember } = useKasiStore();
  const [data, setData] = useState<MatrixData | null>(null);
  const [earnings, setEarnings] = useState<DashboardEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusLevel, setFocusLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!currentMember) return;
    let active = true;
    async function load() {
      try {
        const [matrixRes, dashRes] = await Promise.all([
          fetch(`/api/matrix?memberId=${currentMember!.id}`, { cache: "no-store" }),
          fetch(`/api/dashboard?memberId=${currentMember!.id}`, { cache: "no-store" }),
        ]);
        if (active && matrixRes.ok) setData(await matrixRes.json());
        if (active && !matrixRes.ok) setError("The Eco-System could not be loaded. Please try again.");
        if (active && dashRes.ok) {
          const d = await dashRes.json();
          setEarnings({
            earningsToday: d.earningsToday ?? 0,
            earningsThisWeek: d.earningsThisWeek ?? 0,
            earningsThisMonth: d.earningsThisMonth ?? 0,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [currentMember]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <Network className="mx-auto mb-3 h-8 w-8 text-orange-500" />
        <h2 className="text-lg font-bold">Eco-System temporarily unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "No Eco-System data was returned."}</p>
      </Card>
    );
  }

  const totalCommission = data.levelStats.reduce((s, l) => s + l.commission, 0);
  const totalDownline = data.levelStats.reduce((s, l) => s + l.count, 0);
  const totalSpots = 19530; // 5^0 + 5^1 + 5^2 + 5^3 + 5^4 + 5^5

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Network className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-black tracking-tight">5 × 6 Eco-System</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your position is{" "}
          <span className="font-mono font-semibold">#{data.myNodeIndex}</span> at level{" "}
          {data.myLevel}. The 5×6 structure fills top-left to bottom-right — spillover
          from upline fills your Eco-System downline.
        </p>
      </div>

      {data.placementStatus === "pending" && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          This tester account is ready to explore the Eco-System. Its live matrix placement will appear after membership activation.
        </Card>
      )}

      {/* Earnings blocks */}
      <div className="grid gap-4 sm:grid-cols-3">
        <EarningsCard
          label="Daily Earnings"
          sublabel="Today"
          value={earnings?.earningsToday ?? 0}
          icon={<Wallet className="h-4 w-4" />}
          color="emerald"
        />
        <EarningsCard
          label="Weekly Earnings"
          sublabel="Mon – Sun"
          value={earnings?.earningsThisWeek ?? 0}
          icon={<Calendar className="h-4 w-4" />}
          color="amber"
        />
        <EarningsCard
          label="Monthly Earnings"
          sublabel="1st – last day"
          value={earnings?.earningsThisMonth ?? 0}
          icon={<TrendingUp className="h-4 w-4" />}
          color="teal"
        />
      </div>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Eco-System downline</p>
          </div>
          <p className="text-2xl font-black mt-1">{totalDownline}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Monthly commission</p>
          </div>
          <p className="text-2xl font-black mt-1 text-emerald-600">
            {formatZAR(totalCommission)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Levels filled</p>
          </div>
          <p className="text-2xl font-black mt-1">
            {data.levelStats.filter((l) => l.count > 0).length} / 6
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <GitFork className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total spots</p>
          </div>
          <p className="text-2xl font-black mt-1">
            {totalSpots.toLocaleString("en-ZA")}
          </p>
        </Card>
      </div>

      {/* Level breakdown */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-bold">Level breakdown</h3>
            <p className="text-xs text-muted-foreground">
              R47 of each R140 subscription is paid up 6 levels
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {data.levelStats.map((l) => {
            const pct = l.maxCount > 0 ? (l.count / l.maxCount) * 100 : 0;
            const isActive = focusLevel === l.level;
            const color = colorForLevel(l.level);
            return (
              <button
                key={l.level}
                onClick={() => setFocusLevel(isActive ? null : l.level)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  isActive
                    ? `${color.softBg} ring-1 ${color.ring}`
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${color.gradientFrom} ${color.gradientTo} text-white text-xs font-bold flex items-center justify-center`}
                    >
                      {l.level}
                    </span>
                    <span className="font-semibold text-sm">Level {l.level}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.count} / {l.maxCount} filled
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      R{l.commission.toFixed(0)}/mo
                    </span>
                    <span className={`font-bold ${color.text}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Custom progress bar so each level uses its own color */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color.oklch }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, pct)}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Eco-System tree visualization */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-bold">Eco-System tree</h3>
            <p className="text-xs text-muted-foreground">
              Up to 6 levels deep, 5 wide per node · drag to explore
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500" />
              <span className="text-muted-foreground">You</span>
            </div>
            {LEVEL_COLORS.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${c.swatch}`} />
                <span className="text-muted-foreground capitalize">L{LEVEL_COLORS.indexOf(c) + 1} · {c.name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              <span className="text-muted-foreground">Open spot</span>
            </div>
          </div>
        </div>

        <DraggableTreeCanvas>
          <TooltipProvider>
            <div className="min-w-[800px] py-1">
              {data.tree && <MatrixRow node={data.tree} focusLevel={focusLevel} />}
            </div>
          </TooltipProvider>
        </DraggableTreeCanvas>
      </Card>

      {/* Info card */}
      <Card className="p-5 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">How the 5 × 6 Eco-System works</p>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
              <li>
                The Eco-System has 6 levels. Each node has up to 5 direct children —
                total 19,530 spots.
              </li>
              <li>
                New members are placed in the <strong>first open spot</strong>,
                filling top-left to bottom-right.
              </li>
              <li>
                R47 of every R140 subscription is distributed up 6 levels. You earn
                from your entire Eco-System downline.
              </li>
              <li>Spillover from upline fills your downline.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Pointer panning works for mouse, pen, and touch without hiding native scrollbars.
// Author: Klaasvaakie ( |╲ )
function DraggableTreeCanvas({ children }: { children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });
  const [dragging, setDragging] = useState(false);

  function finishDrag(pointerId: number) {
    const viewport = viewportRef.current;
    if (!viewport || dragRef.current.pointerId !== pointerId) return;
    if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
    dragRef.current.pointerId = -1;
    setDragging(false);
  }

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Draggable Eco-System tree"
      className={`overflow-auto overscroll-contain rounded-lg select-none touch-none ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const viewport = viewportRef.current;
        if (!viewport) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          moved: false,
        };
        viewport.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const viewport = viewportRef.current;
        const drag = dragRef.current;
        if (!viewport || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
        if (!drag.moved) return;
        event.preventDefault();
        viewport.scrollLeft = drag.scrollLeft - deltaX;
        viewport.scrollTop = drag.scrollTop - deltaY;
      }}
      onPointerUp={(event) => finishDrag(event.pointerId)}
      onPointerCancel={(event) => finishDrag(event.pointerId)}
      onClickCapture={(event) => {
        if (!dragRef.current.moved) return;
        event.preventDefault();
        event.stopPropagation();
        dragRef.current.moved = false;
      }}
    >
      {children}
    </div>
  );
}

function EarningsCard({
  label,
  sublabel,
  value,
  icon,
  color,
}: {
  label: string;
  sublabel: string;
  value: number;
  icon: React.ReactNode;
  color: "emerald" | "amber" | "teal";
}) {
  const styles: Record<
    "emerald" | "amber" | "teal",
    { gradient: string; ring: string; text: string; iconBg: string }
  > = {
    emerald: {
      gradient: "from-emerald-50 to-white dark:from-emerald-950/40 dark:to-card",
      ring: "ring-emerald-200 dark:ring-emerald-900",
      text: "text-emerald-700 dark:text-emerald-300",
      iconBg:
        "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300",
    },
    amber: {
      gradient: "from-amber-50 to-white dark:from-amber-950/40 dark:to-card",
      ring: "ring-amber-200 dark:ring-amber-900",
      text: "text-amber-700 dark:text-amber-300",
      iconBg:
        "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300",
    },
    teal: {
      gradient: "from-teal-50 to-white dark:from-teal-950/40 dark:to-card",
      ring: "ring-teal-200 dark:ring-teal-900",
      text: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-300",
    },
  };
  const c = styles[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className={`p-5 bg-gradient-to-br ${c.gradient} ring-1 ${c.ring}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-black mt-1 ${c.text} truncate`}>
              {formatZAR(value)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{sublabel}</p>
          </div>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.iconBg}`}
          >
            {icon}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function MatrixRow({
  node,
  focusLevel,
  level = 0,
}: {
  node: TreeNode;
  focusLevel: number | null;
  level?: number;
}) {
  if (level > 5) return null;
  const dim = focusLevel !== null && level > focusLevel;
  return (
    <div
      className={`flex flex-col items-center transition-opacity ${
        dim ? "opacity-30" : ""
      }`}
    >
      <MatrixNode node={node} treeLevel={level} />
      {node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-2 sm:gap-3">
            {Array.from({ length: 5 }).map((_, i) => {
              const child = node.children[i];
              return child ? (
                <MatrixRow
                  key={child.id}
                  node={child}
                  focusLevel={focusLevel}
                  level={level + 1}
                />
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

function MatrixNode({ node, treeLevel }: { node: TreeNode; treeLevel: number }) {
  const Icon =
    node.member.membershipType === "COMPANY"
      ? Building2
      : node.isMe
        ? Crown
        : User;
  const name =
    node.member.companyName ||
    `${node.member.firstName || ""} ${node.member.lastName || ""}`.trim() ||
    "Member";
  const color = colorForLevel(treeLevel);
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
              : `${color.border} bg-card ${color.hoverBorder}`
          }`}
        >
          {/* level color tint */}
          {!node.isMe && (
            <span
              className="absolute inset-0 rounded-[10px] opacity-[0.12] pointer-events-none"
              style={{ backgroundColor: color.oklch }}
            />
          )}
          <Icon
            className={`h-5 w-5 mb-0.5 relative ${node.isMe ? "text-white" : color.text}`}
          />
          <p
            className={`text-[9px] font-medium text-center px-1 leading-tight truncate max-w-full relative ${
              node.isMe ? "text-white" : "text-foreground"
            }`}
          >
            {name.split(" ")[0]}
          </p>
          <p
            className={`text-[8px] font-mono relative ${
              node.isMe ? "text-white/80" : "text-muted-foreground"
            }`}
          >
            {node.member.profileNumber}
          </p>
          {node.member.subscriptionStatus === "LAPSED" && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-background" />
          )}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent className="bg-primary text-primary-foreground border border-primary-foreground/20">
        <div className="text-xs space-y-0.5">
          <p className="font-bold text-sm">{name}</p>
          <p className="text-primary-foreground/80 font-mono">{node.member.profileNumber}</p>
          <p className="text-primary-foreground/70">
            {node.member.membershipType.replace(/_/g, " ")} · {node.member.country}
          </p>
          <p className="text-primary-foreground/70">
            Status: {node.member.subscriptionStatus}
          </p>
          <p className="text-primary-foreground/70 capitalize">
            Level {Math.max(1, treeLevel)} · {color.name}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EmptySpot({ level }: { level: number }) {
  const color = colorForLevel(level);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed ${color.border} text-muted-foreground/40`}
        >
          <UserCircle2 className="h-5 w-5" />
          <p className="text-[8px] mt-0.5">Open · L{level}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-primary text-primary-foreground border border-primary-foreground/20">
        <p className="text-xs font-semibold">Open position at level {level}</p>
        <p className="text-primary-foreground/70 text-[10px]">
          Next member will be placed here
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
