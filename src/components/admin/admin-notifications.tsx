"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, Loader2, Send, Clock, CheckCircle2, Zap, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Notification {
  id: string; memberId: string; daysBefore: number; channel: string;
  status: string; message: string; sentAt: string;
  member: { profileNumber: string; name: string; mobile: string };
}

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({ total: 0, sent5Days: 0, sent3Days: 0, sent1Day: 0, activeMembers: 0 });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function trigger(daysBefore: number) {
    setTriggering(daysBefore);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBefore }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Trigger failed");
      } else {
        toast.success(result.message);
        await load();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTriggering(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1"><MessageCircle className="h-5 w-5 text-emerald-600" /><h2 className="text-2xl font-black tracking-tight">Subscription notifications</h2></div>
        <p className="text-sm text-muted-foreground">WhatsApp renewal reminders sent via WABlast at 5, 3, and 1 day(s) before subscription renewal.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Active members</p><Users className="h-4 w-4 text-emerald-600" /></div><p className="text-2xl font-black mt-1">{stats.activeMembers}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">5-day reminders</p><Clock className="h-4 w-4 text-amber-600" /></div><p className="text-2xl font-black mt-1 text-amber-600">{stats.sent5Days}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">3-day reminders</p><Clock className="h-4 w-4 text-orange-600" /></div><p className="text-2xl font-black mt-1 text-orange-600">{stats.sent3Days}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">1-day reminders</p><Zap className="h-4 w-4 text-rose-600" /></div><p className="text-2xl font-black mt-1 text-rose-600">{stats.sent1Day}</p></Card>
      </div>

      {/* Trigger buttons */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { days: 5, label: "5-day reminder", desc: "Sent 5 days before renewal", color: "from-amber-500 to-amber-600", icon: Clock },
          { days: 3, label: "3-day reminder", desc: "Sent 3 days before renewal", color: "from-orange-500 to-orange-600", icon: Clock },
          { days: 1, label: "1-day reminder", desc: "Sent 1 day before renewal (URGENT)", color: "from-rose-500 to-rose-600", icon: Zap },
        ].map((t) => (
          <Card key={t.days} className={`p-5 bg-gradient-to-br ${t.color} text-white border-0 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur"><t.icon className="h-5 w-5" /></div><div><p className="font-bold">{t.label}</p><p className="text-xs opacity-90">{t.desc}</p></div></div>
              <Button variant="secondary" size="sm" onClick={() => trigger(t.days)} disabled={triggering === t.days} className="w-full">
                {triggering === t.days ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />Trigger to all active members</>}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Notification history */}
      <Card className="p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp notification history ({notifications.length})</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-kasi">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications sent yet.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${n.daysBefore === 5 ? "bg-amber-50 dark:bg-amber-950/40" : n.daysBefore === 3 ? "bg-orange-50 dark:bg-orange-950/40" : "bg-rose-50 dark:bg-rose-950/40"}`}>
                  <MessageCircle className={`h-4 w-4 ${n.daysBefore === 5 ? "text-amber-600" : n.daysBefore === 3 ? "text-orange-600" : "text-rose-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground">{n.member.name} · {n.member.mobile} · {new Date(n.sentAt).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${n.daysBefore === 5 ? "bg-amber-50 text-amber-700 border-amber-200" : n.daysBefore === 3 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                  {n.daysBefore} day{n.daysBefore > 1 ? "s" : ""}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
