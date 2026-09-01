// Author: Klaasvaakie ( |╲ )
"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Edit,
  Loader2,
  MailPlus,
  Plus,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { privatePresaleInviteUrl } from "@/lib/presale-links";
import { campaignAcceptsInvitations, campaignSavePayload } from "@/lib/presale-campaign";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  issuerName: string;
  shareClass: string;
  status: "draft" | "active" | "paused" | "closed";
  totalShares: number;
  reservedShares: number;
  soldShares: number;
  priceUsdt: number;
  priceUsd: number;
  usdtPerUsd: number;
  sharePhaseNumber: number;
  network: "bsc" | "tron";
  tokenContract?: string;
  receivingAddress?: string;
  minConfirmations: number;
  paymentWindowMinutes: number;
  bonusBuyOneGet: boolean;
  isMock: boolean;
  startsAt?: string;
  endsAt?: string;
};
type Draft = Omit<Campaign, "id" | "reservedShares" | "soldShares"> & {
  id?: string;
};

const blankDraft = (): Draft => ({
  slug: "",
  name: "",
  issuerName: "",
  shareClass: "",
  status: "draft",
  totalShares: 0,
  priceUsdt: 0,
  priceUsd: 25,
  usdtPerUsd: 1,
  sharePhaseNumber: 1,
  network: "bsc",
  tokenContract: "",
  receivingAddress: "",
  minConfirmations: 15,
  paymentWindowMinutes: 30,
  bonusBuyOneGet: false,
  isMock: false,
  startsAt: "",
  endsAt: "",
});
const localDate = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

export function AdminPresaleCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [inviteCampaign, setInviteCampaign] = useState<Campaign | null>(null);
  const [invite, setInvite] = useState({
    email: "",
    maxShares: "",
    expiresAt: "",
  });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/admin/presale/campaigns", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCampaigns(data.campaigns ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load campaigns",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function newCampaign() {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    const data = response.ok
      ? ((await response.json()) as {
          raw?: Array<{ key: string; value: string }>;
        })
      : {};
    const defaults = Object.fromEntries(
      (data.raw ?? [])
        .filter((item) => item.key.startsWith("presale_default_"))
        .map((item) => [item.key, item.value]),
    );
    setDraft({
      ...blankDraft(),
      issuerName: defaults.presale_default_issuer_name ?? "",
      shareClass: defaults.presale_default_share_class ?? "",
      network: "bsc",
      receivingAddress: defaults.presale_default_receiving_address ?? "",
      tokenContract: defaults.presale_default_token_contract ?? "",
      usdtPerUsd: Number(defaults.presale_default_usdt_per_usd ?? 1),
      minConfirmations: Number(
        defaults.presale_default_min_confirmations ?? 15,
      ),
      paymentWindowMinutes: Number(
        defaults.presale_default_payment_window_minutes ?? 30,
      ),
    });
  }
  function edit(campaign: Campaign) {
    setDraft({
      ...campaign,
      network: "bsc",
      startsAt: localDate(campaign.startsAt),
      endsAt: localDate(campaign.endsAt),
    });
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveCampaign() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/presale/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(campaignSavePayload(draft)),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Campaign could not be saved");
      toast.success(draft.id ? "Campaign updated" : "Campaign created");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Campaign could not be saved",
      );
    } finally {
      setSaving(false);
    }
  }
  async function createInvitation() {
    if (!inviteCampaign) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/presale/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          campaignId: inviteCampaign.id,
          email: invite.email || undefined,
          maxShares: Number(invite.maxShares),
          expiresAt: new Date(invite.expiresAt).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Invitation could not be created");
      setInviteCampaign(null);
      setInvite({ email: "", maxShares: "", expiresAt: "" });
      setInviteLink(privatePresaleInviteUrl(data.inviteToken));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Invitation could not be created",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Card className="p-5">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap gap-2 mb-5">
          <Button
            onClick={() => void newCampaign()}
            className="bg-gradient-to-r from-amber-500 to-amber-600"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New campaign
          </Button>
        </div>
        {campaigns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No private campaigns yet. Save defaults, then create a draft.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{campaign.name}</p>
                      <Badge
                        variant={
                          campaign.status === "active" ? "default" : "outline"
                        }
                        className={
                          campaign.status === "active" ? "bg-emerald-600" : ""
                        }
                      >
                        {campaign.status}
                      </Badge>
                      {campaign.isMock && (
                        <Badge
                          variant="outline"
                          className="border-slate-300 bg-slate-50 text-slate-700"
                        >
                          Mock
                        </Badge>
                      )}
                      {campaign.bonusBuyOneGet && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-700"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          BOGO
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.shareClass} ·{" "}
                      {campaign.priceUsdt.toLocaleString()} USDT/share ·{" "}
                      {campaign.soldShares.toLocaleString()} sold ·{" "}
                      {(
                        campaign.totalShares -
                        campaign.reservedShares -
                        campaign.soldShares
                      ).toLocaleString()}{" "}
                      available
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => edit(campaign)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    {campaignAcceptsInvitations(campaign) && !campaign.isMock && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInviteCampaign(campaign);
                          setInvite({
                            email: "",
                            maxShares: "",
                            expiresAt: "",
                          });
                        }}
                      >
                        <MailPlus className="h-3.5 w-3.5 mr-1" />
                        Invite
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit private campaign" : "Create private campaign"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <Field
                label="Campaign name"
                value={draft.name}
                onChange={(v) => update("name", v)}
              />
              <Field
                label="URL slug"
                value={draft.slug}
                onChange={(v) =>
                  update("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
              />
              <Field
                label="Issuer"
                value={draft.issuerName}
                onChange={(v) => update("issuerName", v)}
              />
              <Field
                label="Share class"
                value={draft.shareClass}
                onChange={(v) => update("shareClass", v)}
              />
              <NumberField
                label="Total issued shares"
                value={draft.totalShares}
                onChange={(v) => update("totalShares", v)}
              />
              <NumberField
                label="USD price per paid share"
                value={draft.priceUsd}
                onChange={(v) => update("priceUsd", v)}
              />
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    update("status", value as Draft["status"])
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Network</Label>
                <div className="mt-1 flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">BNB Smart Chain (BSC / BEP20)</div>
              </div>
              <Field
                label="Receiving address"
                value={draft.receivingAddress ?? ""}
                onChange={(v) => update("receivingAddress", v)}
              />
              <Field
                label="USDT token contract"
                value={draft.tokenContract ?? ""}
                onChange={(v) => update("tokenContract", v)}
              />
              <NumberField
                label="Minimum confirmations"
                value={draft.minConfirmations}
                onChange={(v) => update("minConfirmations", v)}
              />
              <NumberField
                label="Payment window (minutes)"
                value={draft.paymentWindowMinutes}
                onChange={(v) => update("paymentWindowMinutes", v)}
              />
              <label className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
                <input
                  type="checkbox"
                  checked={draft.bonusBuyOneGet}
                  onChange={(event) =>
                    update("bonusBuyOneGet", event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                />
                <span>
                  <span className="font-semibold">Buy One Get One</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    A paid share issues one additional bonus share. Campaign
                    inventory, settlement, and certificates account for both.
                  </span>
                </span>
              </label>
              <div>
                <Label>Starts at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={draft.startsAt ?? ""}
                  onChange={(e) => update("startsAt", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Ends at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={draft.endsAt ?? ""}
                  onChange={(e) => update("endsAt", e.target.value)}
                  className="mt-1"
                />
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                An active campaign must contain complete, verified payment route
                details. Creating a campaign does not issue an invitation or
                accept a payment.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveCampaign()}
              disabled={saving}
              className="bg-gradient-to-r from-amber-500 to-amber-600"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-1" />
                  Save campaign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(inviteCampaign)}
        onOpenChange={(open) => !open && setInviteCampaign(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create private invitation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field
              label="Invitee email (optional)"
              value={invite.email}
              onChange={(v) =>
                setInvite((current) => ({ ...current, email: v }))
              }
            />
            <div>
              <Label>Maximum shares</Label>
              <Input
                type="number"
                min="1"
                value={invite.maxShares}
                onChange={(e) =>
                  setInvite((current) => ({
                    ...current,
                    maxShares: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Expires at</Label>
              <Input
                type="datetime-local"
                value={invite.expiresAt}
                onChange={(e) =>
                  setInvite((current) => ({
                    ...current,
                    expiresAt: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteCampaign(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createInvitation()}
              disabled={saving || !invite.maxShares || !invite.expiresAt}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(inviteLink)}
        onOpenChange={(open) => !open && setInviteLink(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation link created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy and share this link securely. It is shown only now.
          </p>
          <Input readOnly value={inviteLink ?? ""} />
          <DialogFooter>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink ?? "");
                toast.success("Invitation link copied");
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy link
            </Button>
            <Button variant="outline" onClick={() => setInviteLink(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1"
      />
    </div>
  );
}
