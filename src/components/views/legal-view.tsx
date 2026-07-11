"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Scale, FileText, Receipt, ShieldCheck, Loader2, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

type LegalType = "terms" | "tax" | "privacy";

interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDocument {
  title: string;
  lastUpdated: string;
  content: LegalSection[];
}

interface LegalResponse {
  document: LegalDocument;
}

const TAB_META: { value: LegalType; label: string; icon: typeof FileText }[] = [
  { value: "terms", label: "Terms & Conditions", icon: FileText },
  { value: "tax", label: "Tax Compliance", icon: Receipt },
  { value: "privacy", label: "Privacy Policy", icon: ShieldCheck },
];

function formatLegalDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function LegalView() {
  const [activeTab, setActiveTab] = useState<LegalType>("terms");
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoc = useCallback(async (type: LegalType) => {
    setLoading(true);
    setError(null);
    setDoc(null);
    try {
      const res = await fetch(`/api/legal?type=${type}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
      const data: LegalResponse = await res.json();
      setDoc(data.document ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load document");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoc(activeTab);
  }, [activeTab, fetchDoc]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card className="p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <Scale className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Legal</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Terms &amp; Conditions, Tax Compliance, and Privacy Policy
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LegalType)}>
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
          {TAB_META.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_META.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4 space-y-4">
            {loading ? (
              <Card className="p-12">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  <p className="text-sm">Loading document…</p>
                </div>
              </Card>
            ) : error ? (
              <Card className="p-8 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Could not load document
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>
              </Card>
            ) : !doc ? (
              <Card className="p-8">
                <p className="text-sm text-muted-foreground text-center">No document available.</p>
              </Card>
            ) : (
              <>
                {/* Document title + last updated */}
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
                        {doc.title}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 self-start"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Last updated: {formatLegalDate(doc.lastUpdated)}
                    </Badge>
                  </div>
                </Card>

                {/* Content sections */}
                {doc.content.length === 0 ? (
                  <Card className="p-8">
                    <p className="text-sm text-muted-foreground text-center">This document has no sections yet.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {doc.content.map((section, idx) => (
                      <Card key={idx} className="p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-base text-foreground">{section.heading}</h4>
                        </div>
                        <Separator className="mb-4" />
                        <div className="max-w-prose">
                          <p className="text-sm leading-7 text-muted-foreground whitespace-pre-line">
                            {section.body}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default LegalView;
