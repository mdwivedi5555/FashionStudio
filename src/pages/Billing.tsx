import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceSwitcher } from "@/components/studio/WorkspaceSwitcher";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDownToLine,
  Building2,
  Check,
  Loader2,
  LogOut,
  Receipt,
  Sparkles,
  Landmark,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";

const PACKS = [
  { id: "starter", name: "Starter", credits: 200, price: "$19", blurb: "First drops and one-off campaigns" },
  { id: "studio", name: "Studio", credits: 1000, price: "$79", blurb: "Growing e-commerce teams" },
  { id: "atelier", name: "Atelier", credits: 5000, price: "$299", blurb: "High-velocity catalog work" },
];

export default function Billing() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const account = useQuery(api.studio.getAccount, {});
  const ledger = useQuery(api.bulk.listLedger, {}) ?? [];
  const invoices = useQuery(api.bulk.listInvoices, {}) ?? [];
  const topUp = useMutation(api.bulk.topUpCredits);
  const settleInvoice = useMutation(api.bulk.settleInvoice);
  const issueInvoice = useMutation(api.studio.issueInvoice);

  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [genCount, setGenCount] = useState("250");
  const [amount, setAmount] = useState("1250.00");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handlePurchase = async (packId: string) => {
    setLoadingPack(packId);
    try {
      // Stripe Checkout session creation goes here once STRIPE_SECRET_KEY is set.
      // Until then, credits are provisioned directly so the flow is verifiable.
      const res = await topUp({ packId });
      toast.success(`Provisioned ${res.credits} total credits — Stripe checkout pending key setup`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setLoadingPack(null);
    }
  };

  const handleIssue = async () => {
    try {
      await issueInvoice({
        periodLabel: new Date().toLocaleDateString("en", { month: "long", year: "numeric" }),
        generationCount: Number(genCount) || 0,
        amountCents: Math.round((Number(amount) || 0) * 100),
      });
      toast.success("Net-30 invoice issued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue invoice");
    }
  };

  const handleSettle = async (invoiceId: string) => {
    try {
      await settleInvoice({
        invoiceId: invoiceId as never,
        settledVia: "Corporate banking — Axis Bank Corporate Internet Banking",
      });
      toast.success("Invoice marked settled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed");
    }
  };

  const fmtCents = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="Luxemee" className="size-7" />
              <span className="studio-serif text-base tracking-wide">LUXEMEE</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
            <Badge variant="outline" className="rounded-none border-border font-normal">
              <Sparkles className="mr-1 size-3" />
              {account ? `${account.credits} credits` : "…"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <p className="studio-eyebrow">Billing</p>
          <h1 className="studio-serif mt-2 text-3xl tracking-tight">Credits & enterprise invoicing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Self-serve packs for studio teams; net-30 corporate invoicing for wholesale accounts,
            settled via standard corporate banking channels.
          </p>
        </div>

        {/* Credit packs */}
        <section className="mt-8">
          <p className="studio-eyebrow mb-3">Credit Packs</p>
          <div className="grid gap-4 md:grid-cols-3">
            {PACKS.map((p) => (
              <div key={p.id} className="studio-frame studio-frame-hover flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <h3 className="studio-serif text-xl">{p.name}</h3>
                  <span className="studio-serif text-2xl">{p.price}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
                <p className="mt-4 text-sm">
                  <span className="font-medium">{p.credits.toLocaleString()}</span>
                  <span className="text-muted-foreground"> renders</span>
                </p>
                <Button
                  className="mt-5"
                  variant={p.id === "studio" ? "default" : "outline"}
                  disabled={loadingPack !== null || account === undefined}
                  onClick={() => handlePurchase(p.id)}
                >
                  {loadingPack === p.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                  {loadingPack === p.id ? "Provisioning…" : "Purchase"}
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Enterprise invoicing */}
        <section className="mt-12">
          <p className="studio-eyebrow mb-3">Enterprise Invoicing — Net-30</p>
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="studio-frame flex flex-col">
              <div className="border-b border-border/70 px-5 py-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="size-4" /> Invoices
                </p>
              </div>
              {invoices.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No invoices yet. Wholesale accounts can issue one from the right panel.
                </p>
              ) : (
                <div className="divide-y divide-border/70">
                  {invoices.map((inv) => (
                    <div key={inv._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{inv.number}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {inv.periodLabel} · {inv.generationCount.toLocaleString()} generations
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm tabular-nums">{fmtCents(inv.amountCents)}</span>
                        {inv.status === "paid" ? (
                          <Badge className="rounded-none bg-foreground text-background">
                            PAID {inv.paidAt ? fmtDate(inv.paidAt) : ""}
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-none border-border text-[10px] tracking-widest">
                              DUE {fmtDate(inv.dueAt)}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => handleSettle(inv._id)}>
                              Mark settled
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Issue panel */}
            <div className="studio-frame flex flex-col gap-4 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="size-4" /> Issue an invoice
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                For wholesale accounts. Generates a numbered net-30 invoice for
                thousands of API calls, settled directly via corporate banking —
                no card limits involved.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="genCount" className="text-xs text-muted-foreground">Generation count</Label>
                <Input id="genCount" value={genCount} onChange={(e) => setGenCount(e.target.value)} className="rounded-none" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount" className="text-xs text-muted-foreground">Amount (USD)</Label>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-none" />
              </div>
              <Button onClick={handleIssue} className="mt-1">
                <Receipt className="mr-2 size-4" /> Issue net-30 invoice
              </Button>
              <p className="text-[10px] leading-4 text-muted-foreground">
                Requires a wholesale (enterprise) account. Enterprise flags are
                granted by the platform once a corporate agreement is in place.
              </p>
            </div>
          </div>
        </section>

        {/* Ledger */}
        <section className="mt-12 pb-12">
          <p className="studio-eyebrow mb-3">Credit Ledger</p>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <div className="divide-y divide-border/70 border border-border">
              {ledger.map((l) => (
                <div key={l._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <ArrowDownToLine className={`size-3.5 ${l.delta < 0 ? "rotate-180 text-muted-foreground" : "text-foreground"}`} />
                    <span className="text-muted-foreground">{l.reason}</span>
                  </div>
                  <span className={`tabular-nums ${l.delta < 0 ? "text-muted-foreground" : "text-foreground"}`}>
                    {l.delta > 0 ? "+" : ""}
                    {l.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
