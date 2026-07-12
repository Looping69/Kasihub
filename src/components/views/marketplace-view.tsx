"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Loader2, Search, Star, Wallet, TrendingUp,
  Zap, ShieldCheck, Store, ArrowRight, CheckCircle2, Receipt,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useKasiStore } from "@/lib/store";
import type { MarketplaceProduct, MarketplaceOrder } from "@/lib/types";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "ALL", label: "All" },
  { key: "AIRTIME", label: "Airtime & Data" },
  { key: "GROCERIES", label: "Groceries" },
  { key: "UTILITIES", label: "Utilities" },
  { key: "INSURANCE", label: "Insurance" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "HEALTH", label: "Health" },
];

const COLOR_MAP: Record<string, string> = {
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  yellow: "from-yellow-500 to-amber-500",
  emerald: "from-emerald-500 to-emerald-600",
  slate: "from-slate-500 to-slate-600",
  cyan: "from-cyan-500 to-cyan-600",
  teal: "from-teal-500 to-emerald-600",
  violet: "from-violet-500 to-purple-600",
  orange: "from-orange-500 to-amber-600",
  lime: "from-lime-500 to-emerald-500",
  blue: "from-blue-500 to-cyan-600",
  pink: "from-pink-500 to-rose-600",
};

export function MarketplaceView() {
  const { currentMember } = useKasiStore();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<MarketplaceOrder[]>([]);
  const [isFreeMember, setIsFreeMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [buyProduct, setBuyProduct] = useState<MarketplaceProduct | null>(null);
  const [buying, setBuying] = useState(false);

  async function load() {
    if (!currentMember) return;
    try {
      const res = await fetch(`/api/marketplace?memberId=${currentMember.id}&category=${category}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setRecentOrders(data.recentOrders);
        setIsFreeMember(data.isFreeMember);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentMember, category]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.provider.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  async function handleBuy() {
    if (!currentMember || !buyProduct) return;
    setBuying(true);
    try {
      const res = await fetch("/api/marketplace/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: currentMember.id, productId: buyProduct.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Order failed");
      } else {
        toast.success(`Order placed! ${buyProduct.name} — R${buyProduct.price}. Commission of R${result.commission.toFixed(2)} sent to KasiPool.`);
        setBuyProduct(null);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-black tracking-tight">KasiMarketPlace</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Virtual marketplace of third-party products & services. Every purchase generates commission that flows into the KasiPool.
        </p>
      </div>

      {/* Pricing tier banner */}
      <Card className={`p-5 relative overflow-hidden ${isFreeMember ? "bg-gradient-to-br from-amber-500 to-amber-600" : "bg-gradient-to-br from-emerald-600 to-emerald-700"} text-white border-0`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-x-1/4 -translate-y-1/4" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
              {isFreeMember ? <ShieldCheck className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}
            </div>
            <div>
              <p className="font-bold text-lg">
                {isFreeMember ? "Free Member pricing" : "Your purchases fuel the KasiPool"}
              </p>
              <p className="text-sm opacity-90">
                {isFreeMember
                  ? "Free members pay slightly higher prices. Upgrade to a paid membership for member pricing."
                  : "Each order sends commission to the shared pool — paid out nightly to all members."}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 rounded-lg bg-white/10 backdrop-blur">
              <p className="text-2xl font-black">{recentOrders.length}</p>
              <p className="text-[10px] text-emerald-50">your orders</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products grid */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No products found</p>
          <p className="text-sm text-muted-foreground">Try a different category or search term.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full overflow-hidden hover:shadow-lg transition-all group flex flex-col">
                <div className={`h-32 bg-gradient-to-br ${COLOR_MAP[p.imageColor] || "from-emerald-500 to-amber-500"} relative flex items-center justify-center`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="relative text-center text-white">
                    <p className="text-3xl font-black opacity-90">{p.provider[0]}</p>
                    <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1">{p.category}</p>
                  </div>
                  {p.popular && (
                    <Badge className="absolute top-2 right-2 bg-white/90 text-foreground hover:bg-white">
                      <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" /> Popular
                    </Badge>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm leading-tight">{p.name}</h3>
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {p.rating}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{p.description}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[9px] h-4 bg-emerald-50 text-emerald-700 border-emerald-200">
                      <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> {p.commissionPct}% to KasiPool
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black">R {(p as MarketplaceProduct & { displayPrice?: number }).displayPrice?.toFixed(2) || p.price.toFixed(2)}</p>
                      {isFreeMember && (p as MarketplaceProduct & { freePrice?: number }).freePrice && (p as MarketplaceProduct & { freePrice?: number }).freePrice! > p.price && (
                        <p className="text-[9px] text-amber-600 line-through">R {p.price.toFixed(2)} member price</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">by {p.provider}</p>
                    </div>
                    <Button size="sm" onClick={() => setBuyProduct(p)} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
                      Buy <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-600" /> Your recent orders
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-kasi">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.productName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">R {o.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-600">+R {o.commission.toFixed(2)} to pool</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Buy dialog */}
      <Dialog open={!!buyProduct} onOpenChange={(o) => !o && setBuyProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm purchase</DialogTitle>
          </DialogHeader>
          {buyProduct && (
            <div className="space-y-4 py-2">
              <div className={`h-24 rounded-xl bg-gradient-to-br ${COLOR_MAP[buyProduct.imageColor]} flex items-center justify-center text-white`}>
                <div className="text-center">
                  <p className="text-2xl font-black">{buyProduct.provider[0]}</p>
                  <p className="text-[10px] uppercase tracking-wider opacity-80">{buyProduct.category}</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold">{buyProduct.name}</h3>
                <p className="text-sm text-muted-foreground">{buyProduct.description}</p>
              </div>
              <Card className="p-4 bg-muted/30 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-semibold">R {buyProduct.price.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission to KasiPool</span><span className="font-semibold text-emerald-600">R {(buyProduct.price * buyProduct.commissionPct / 100).toFixed(2)} ({buyProduct.commissionPct}%)</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Paid from</span><span className="font-semibold font-mono text-xs">Roots Bank ****{currentMember?.visaCardLast4}</span></div>
              </Card>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>This purchase contributes to tonight&apos;s KasiPool distribution, shared with all eligible Hub members at 12:00 SAST.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyProduct(null)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={buying} className="bg-gradient-to-r from-emerald-600 to-emerald-500">
              {buying ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing...</> : <>Pay R {buyProduct?.price.toFixed(2)}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
