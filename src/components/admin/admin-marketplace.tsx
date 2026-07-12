"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag, Loader2, Plus, Edit, Trash2, Search, Star,
  TrendingUp, DollarSign, Package, Save, X,
  Crown, Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Product {
  id: string; name: string; description: string; category: string; provider: string;
  price: number; freePrice: number; freePriceDelta: number; currency: string;
  commissionPct: number; imageColor: string; rating: number; popular: boolean;
}
interface Order {
  id: string; productName: string; amount: number; commission: number; status: string;
  pricingTier: "PAID" | "FREE"; createdAt: string;
  member: { profileNumber: string; name: string };
}
interface CategoryStat {
  category: string; revenue: number; commission: number; orderCount: number;
  freeOrders: number; paidOrders: number;
}

const COLOR_MAP: Record<string, string> = {
  amber: "from-amber-500 to-amber-600", rose: "from-rose-500 to-rose-600",
  yellow: "from-yellow-500 to-amber-500", emerald: "from-emerald-500 to-emerald-600",
  slate: "from-slate-500 to-slate-600", cyan: "from-cyan-500 to-cyan-600",
  teal: "from-teal-500 to-emerald-600", violet: "from-violet-500 to-purple-600",
  orange: "from-orange-500 to-amber-600", lime: "from-lime-500 to-emerald-500",
  blue: "from-blue-500 to-cyan-600", pink: "from-pink-500 to-rose-600",
};

const EMPTY_PRODUCT: Partial<Product> = {
  name: "", description: "", category: "GROCERIES", provider: "", price: 0,
  freePrice: 0, commissionPct: 5, imageColor: "emerald", rating: 4.5, popular: false,
};

export function AdminMarketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [totals, setTotals] = useState({
    totalRevenue: 0, totalCommission: 0, totalOrders: 0,
    freeMemberOrders: 0, paidMemberOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/marketplace", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setProducts(d.products);
        setOrders(d.orders);
        setCategoryStats(d.categoryStats);
        setTotals({
          totalRevenue: d.totalRevenue,
          totalCommission: d.totalCommission,
          totalOrders: d.totalOrders,
          freeMemberOrders: d.freeMemberOrders ?? 0,
          paidMemberOrders: d.paidMemberOrders ?? 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing || !editing.name || !editing.provider) {
      toast.error("Name and provider are required");
      return;
    }
    setSaving(true);
    try {
      const url = "/api/admin/marketplace";
      const method = isNew ? "POST" : "PATCH";
      const body = isNew ? editing : { productId: editing.id, ...editing };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Save failed");
      } else {
        toast.success(isNew ? "Product created" : "Product updated");
        setEditing(null);
        setIsNew(false);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/marketplace?productId=${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Product deleted");
        setDeleteId(null);
        await load();
      } else {
        toast.error("Delete failed");
      }
    } catch {
      toast.error("Network error");
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmt = (n: number) => `R ${(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.provider.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><ShoppingBag className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">Marketplace management</h2></div>
          <p className="text-sm text-muted-foreground">Manage products, view orders, and track commission to KasiPool.</p>
        </div>
        <Button onClick={() => { setEditing({ ...EMPTY_PRODUCT }); setIsNew(true); }} className="bg-gradient-to-r from-emerald-600 to-emerald-500"><Plus className="h-4 w-4 mr-1.5" />Add product</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total products</p><Package className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{products.length}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total orders</p><ShoppingBag className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1">{totals.totalOrders}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Total revenue</p><DollarSign className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{fmt(totals.totalRevenue)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Commission to KasiPool</p><TrendingUp className="h-4 w-4 text-teal-600" /></div><p className="text-2xl font-black mt-1 text-emerald-600">{fmt(totals.totalCommission)}</p></Card>
        <Card className="p-5 ring-1 ring-emerald-200 dark:ring-emerald-900">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Paid member orders</p><Crown className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-2xl font-black mt-1 text-emerald-600">{totals.paidMemberOrders}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">subscribed members</p>
        </Card>
        <Card className="p-5 ring-1 ring-amber-200 dark:ring-amber-900">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Free member orders</p><Sparkles className="h-4 w-4 text-amber-600" /></div>
          <p className="text-2xl font-black mt-1 text-amber-600">{totals.freeMemberOrders}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">FREE tier members</p>
        </Card>
      </div>

      {/* Category revenue */}
      {categoryStats.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold mb-4">Revenue by category</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {categoryStats.map((c) => (
              <div key={c.category} className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.category}</p>
                <p className="text-lg font-black mt-1">{fmt(c.revenue)}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">+{fmt(c.commission)} pool</p>
                <p className="text-[9px] text-muted-foreground mt-1">{c.orderCount} orders</p>
                <Separator className="my-1.5" />
                <div className="flex items-center justify-center gap-1.5 text-[9px]">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0">{c.paidOrders} paid</Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0">{c.freeOrders} free</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Products */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Products ({filtered.length})</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" />
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-kasi">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Product</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden md:table-cell">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Member price</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Free price</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Commission</th>
                <th className="text-left px-3 py-2 font-semibold text-xs text-muted-foreground uppercase hidden lg:table-cell">Rating</th>
                <th className="text-right px-3 py-2 font-semibold text-xs text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const freeIsSame = !p.freePrice || p.freePrice === 0 || p.freePrice === p.price;
                const delta = p.freePriceDelta ?? (p.price > 0 ? ((p.freePrice - p.price) / p.price) * 100 : 0);
                return (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${COLOR_MAP[p.imageColor] || "from-emerald-500 to-amber-500"} flex items-center justify-center text-white font-bold text-xs`}>{p.provider[0]}</div>
                        <div className="min-w-0"><p className="font-semibold truncate">{p.name} {p.popular && <Star className="inline h-3 w-3 fill-amber-500 text-amber-500 ml-1" />}</p><p className="text-[10px] text-muted-foreground">{p.provider}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell"><Badge variant="outline" className="text-[10px]">{p.category}</Badge></td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(p.price)}</td>
                    <td className="px-3 py-2 text-right">
                      {freeIsSame ? (
                        <span className="text-xs text-muted-foreground italic">Same</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{fmt(p.freePrice)}</span>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 mt-0.5">
                            {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right"><span className="text-emerald-600 font-semibold">{p.commissionPct}%</span></td>
                    <td className="px-3 py-2 hidden lg:table-cell"><span className="flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{p.rating}</span></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing({ ...p }); setIsNew(false); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent orders */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          Recent orders
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{totals.paidMemberOrders} paid</Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px]">{totals.freeMemberOrders} free</Badge>
        </h3>
        <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-kasi">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-emerald-600" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{o.productName}</p>
                  {o.pricingTier === "FREE" ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0">FREE</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">PAID</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{o.member.name} · {new Date(o.createdAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <div className="text-right"><p className="text-sm font-bold">{fmt(o.amount)}</p><p className="text-[10px] text-emerald-600">+{fmt(o.commission)} pool</p></div>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit/Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-kasi">
          <DialogHeader><DialogTitle>{isNew ? "Add product" : "Edit product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div><Label>Name</Label><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" /></div>
              <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5" rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Provider</Label><Input value={editing.provider || ""} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} className="mt-1.5" /></div>
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["GROCERIES", "AIRTIME", "UTILITIES", "INSURANCE", "TRANSPORT", "HEALTH"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price (R)</Label>
                  <Input type="number" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className="mt-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">Base price for paid members.</p>
                </div>
                <div>
                  <Label>Free member price (R)</Label>
                  <Input
                    type="number"
                    value={editing.freePrice ?? 0}
                    onChange={(e) => setEditing({ ...editing, freePrice: parseFloat(e.target.value) || 0 })}
                    className="mt-1.5"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Price for free members (usually 15% higher than member price).</p>
                </div>
              </div>
              {editing.price > 0 && editing.freePrice > 0 && editing.freePrice !== editing.price && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Free members pay <strong>{fmt(editing.freePrice)}</strong> — that's <strong>{(((editing.freePrice - editing.price) / editing.price) * 100).toFixed(0)}%</strong> more than paid members ({fmt(editing.price)}).</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Commission %</Label><Input type="number" value={editing.commissionPct || 0} onChange={(e) => setEditing({ ...editing, commissionPct: parseFloat(e.target.value) || 0 })} className="mt-1.5" /></div>
                <div><Label>Rating</Label><Input type="number" step="0.1" value={editing.rating || 4.5} onChange={(e) => setEditing({ ...editing, rating: parseFloat(e.target.value) || 0 })} className="mt-1.5" /></div>
              </div>
              <div>
                <Label>Card color</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.keys(COLOR_MAP).map((c) => (
                    <button key={c} type="button" onClick={() => setEditing({ ...editing, imageColor: c })} className={`w-8 h-8 rounded-lg bg-gradient-to-br ${COLOR_MAP[c]} ${editing.imageColor === c ? "ring-2 ring-offset-2 ring-emerald-500" : ""}`} title={c} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><p className="font-semibold text-sm">Popular</p><p className="text-xs text-muted-foreground">Show "Popular" badge on card</p></div>
                <Switch checked={editing.popular || false} onCheckedChange={(v) => setEditing({ ...editing, popular: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-emerald-600 to-emerald-500">{saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-1.5" />Save</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete product?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the product from the marketplace. Existing orders will be preserved.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
