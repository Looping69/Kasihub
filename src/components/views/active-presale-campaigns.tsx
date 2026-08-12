// Author: Klaasvaakie ( |╲ )
"use client";

import { useEffect, useState } from "react";
import { LockKeyhole, Rocket, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Campaign = { id: string; name: string; issuerName: string; shareClass: string; totalShares: number; reservedShares: number; soldShares: number; priceUsdt: number; network: "bsc" | "tron"; bonusBuyOneGet: boolean; startsAt?: string; endsAt?: string };

export function ActivePresaleCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { void (async () => { try { const response = await fetch("/api/presale/campaigns", { cache: "no-store" }); if (response.ok) { const data = await response.json() as { campaigns?: Campaign[] }; setCampaigns(data.campaigns ?? []); } } finally { setReady(true); } })(); }, []);
  if (!ready || campaigns.length === 0) return null;
  return <Card className="p-5 border-violet-200 dark:border-violet-900 bg-violet-50/30 dark:bg-violet-950/10"><div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center"><Rocket className="h-5 w-5 text-white" /></div><div><h3 className="font-bold">Private share offers</h3><p className="text-xs text-muted-foreground mt-0.5">Eligible members receive a private invitation link before payment details can be viewed.</p></div></div><div className="grid gap-3 sm:grid-cols-2">{campaigns.map((campaign) => { const available = Math.max(0, campaign.totalShares - campaign.reservedShares - campaign.soldShares); return <div key={campaign.id} className="rounded-xl border bg-background/80 p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-sm">{campaign.name}</p><div className="flex gap-1"><Badge variant="outline" className="text-[10px]">Private</Badge>{campaign.bonusBuyOneGet && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700"><Sparkles className="h-3 w-3 mr-1" />BOGO</Badge>}</div></div><p className="text-xs text-muted-foreground mt-1">{campaign.issuerName} · {campaign.shareClass}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">Price</p><p className="font-bold">{campaign.priceUsdt.toLocaleString()} USDT</p></div><div><p className="text-muted-foreground">Available</p><p className="font-bold">{available.toLocaleString()} shares</p></div></div></div>; })}</div><p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 mt-0.5 text-violet-600 flex-none" />Payment routes and purchase steps are not displayed here. Use only an invitation issued by KaSiHub administration.</p></Card>;
}
