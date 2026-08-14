"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BrandIconTone = "orange" | "green" | "blue";

const BRAND_ICON_GRADIENTS: Record<BrandIconTone, [string, string]> = {
  orange: ["#ff9d13", "#ff5a00"],
  green: ["#85d608", "#22a900"],
  blue: ["#29b6ff", "#0798f2"],
};

const BRAND_ICON_CYCLE: BrandIconTone[] = ["orange", "green", "blue"];

export function brandIconTone(index: number): BrandIconTone {
  return BRAND_ICON_CYCLE[index % BRAND_ICON_CYCLE.length];
}

export function BrandGradientIcon({
  icon: Icon,
  tone,
  className,
}: {
  icon: LucideIcon;
  tone: BrandIconTone;
  className?: string;
}) {
  const gradientId = `kasi-icon-${tone}-${useId().replace(/:/g, "")}`;
  const [start, end] = BRAND_ICON_GRADIENTS[tone];

  return (
    <Icon aria-hidden="true" className={cn("shrink-0", className)} stroke={`url(#${gradientId})`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={start} />
          <stop offset="100%" stopColor={end} />
        </linearGradient>
      </defs>
    </Icon>
  );
}
