import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  BadgeCheck,
  Building2,
  Coins,
  Loader2,
  LogOut,
  Receipt,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";

const fmtCents = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="studio-frame p-4">
      <div className="flex items-center justify-between">
        <p className="studio-eyebrow">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="studio-serif mt-2 text-2xl tabular-nums">{value}</p>
    </div>
  );
}

export function AdminHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="Luxemee" className="size-7" />
            <span className="studio-serif text-base tracking-wide">LUXEMEE</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link to="/dashboard" className="transition-colors hover:text-foreground">Studio</Link>
            <Link to="/bulk" className="transition-colors hover:text-foreground">Bulk</Link>
            <Link to="/billing" className="transition-colors hover:text-foreground">Billing</Link>
            <span className="border-b border-foreground pb-0.5 text-foreground">Admin</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="rounded-none border-studio-gold font-normal">
            <BadgeCheck className="mr-1 size-3" /> OWNER
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

export function StatsSection() {
  const stats = useQuery(api.admin.getStats, {});

  if (stats === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading platform stats…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      <StatCard label="Users" value={String(stats.totalUsers)} icon={Users} />
      <StatCard label="Enterprise" value={String(stats.enterpriseAccounts)} icon={Building2} />
      <StatCard label="Renders" value={String(stats.totalJobs)} icon={Activity} />
      <StatCard label="In pipeline" value={String(stats.activeJobs)} icon={Activity} />
      <StatCard
        label="Failure rate"
        value={`${stats.failureRatePct}%`}
        icon={Activity}
      />
      <StatCard label="Credits out" value={String(stats.creditsInCirculation)} icon={Coins} />
      <StatCard label="Revenue" value={fmtCents(stats.revenueCents)} icon={Receipt} />
      <StatCard label="Outstanding" value={fmtCents(stats.outstandingCents)} icon={Receipt} />
      <StatCard label="Batches" value={String(stats.totalBatches)} icon={Activity} />
    </div>
  );
}

interface AdminUser {
  _id: string;
  email: string | null;
  name: string | null;
  role: string;
  isAnonymous: boolean;
  credits: number;
  plan: string;
  enterprise: boolean;
  jobCount: number;
  failedCount: number;
}

export function UsersSection() {
  const users = useQuery(api.admin.listUsers, {}) ?? [];
  const grantCredits = useMutation(api.admin.grantCredits);
  const setUserRole = useMutation(api.admin.setUserRole);
  const setEnterpriseFlag = useMutation(api.admin.setEnterpriseFlag);

  const [grantOpenFor, setGrantOpenFor] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState("100");
  const [grantReason, setGrantReason] = useState("Goodwill");
  const [busy, setBusy] = useState(false);

  const applyGrant = async (userId: string) => {
    setBusy(true);
    try {
      await grantCredits({
        userId: userId as never,
        amount: Number(grantAmount) || 0,
        reason: grantReason || "Admin grant",
      });
      toast.success(`Granted ${grantAmount} credits`);
      setGrantOpenFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = async (u: AdminUser) => {
    try {
      await setUserRole({
        userId: u._id as never,
        role: u.role === "admin" ? "user" : "admin",
      });
      toast.success(u.role === "admin" ? "Admin role removed" : "Promoted to admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const toggleEnterprise = async (u: AdminUser) => {
    try {
      await setEnterpriseFlag({ userId: u._id as never, enterprise: !u.enterprise });
      toast.success(u.enterprise ? "Enterprise flag removed" : "Enterprise access granted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="studio-frame">
      <div className="border-b border-border/70 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" /> Users ({users.length})
        </p>
      </div>
      <div className="divide-y divide-border/70">
        {users.map((u) => (
          <div key={u._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {u.email ?? (u.isAnonymous ? "Guest user" : "No email")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {u.credits} credits · {u.jobCount} renders
                {u.failedCount > 0 ? ` · ${u.failedCount} failed` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {u.role === "admin" && (
                <Badge className="rounded-none bg-foreground text-background">ADMIN</Badge>
              )}
              {u.enterprise && (
                <Badge variant="outline" className="rounded-none border-studio-gold text-[10px] tracking-widest">
                  ENTERPRISE
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => setGrantOpenFor(u._id)}>
                <Coins className="mr-1 size-3.5" /> Credits
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleRole(u)}>
                {u.role === "admin" ? "Demote" : "Make admin"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleEnterprise(u)}>
                {u.enterprise ? "Revoke ent." : "Grant ent."}
              </Button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No users yet.</p>
        )}
      </div>

      {/* Grant dialog (inline, lightweight) */}
      {grantOpenFor && (
        <div className="border-t border-border bg-studio-sand px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Amount</p>
              <Input
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="w-24 rounded-none"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Reason</p>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="w-48 rounded-none"
              />
            </div>
            <Button size="sm" disabled={busy} onClick={() => applyGrant(grantOpenFor)}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Grant credits"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGrantOpenFor(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline oversight — recent renders across all users
// ---------------------------------------------------------------------------

export function RendersSection() {
  const jobs = useQuery(api.admin.listRecentJobs, {}) ?? [];

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="studio-frame">
      <div className="border-b border-border/70 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Activity className="size-4" /> Recent Renders ({jobs.length})
        </p>
      </div>
      <div className="divide-y divide-border/70">
        {jobs.map((j) => (
          <div key={j._id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={
                  j.status === "done"
                    ? "text-foreground"
                    : j.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                ●
              </span>
              <span className="w-40 truncate text-xs text-muted-foreground">{j.email}</span>
              <span className="truncate text-xs">
                {j.sku ? `SKU ${j.sku}` : "Single look"}
                {j.aesthetic === "prompt_pulse" ? " · PULSE" : ""}
              </span>
              {j.engineUsed && (
                <Badge variant="outline" className="rounded-none border-border text-[9px] tracking-widest">
                  {j.engineUsed.toUpperCase()}
                </Badge>
              )}
              {j.status === "failed" && j.error && (
                <span title={j.error} className="truncate text-[10px] text-destructive">{j.error}</span>
              )}
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {fmtTime(j.createdAt)}
            </span>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No renders yet.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice oversight
// ---------------------------------------------------------------------------

export function InvoicesSection() {
  const invoices = useQuery(api.admin.listAllInvoices, {}) ?? [];
  const markPaid = useMutation(api.admin.markInvoicePaid);

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await markPaid({
        invoiceId: invoiceId as never,
        settledVia: "Manual — admin console",
      });
      toast.success("Invoice marked paid");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="studio-frame">
      <div className="border-b border-border/70 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="size-4" /> Invoices ({invoices.length})
        </p>
      </div>
      <div className="divide-y divide-border/70">
        {invoices.map((inv) => (
          <div key={inv._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="text-sm font-medium">{inv.number}</p>
              <p className="text-[11px] text-muted-foreground">
                {inv.email} · {inv.periodLabel} · {inv.generationCount.toLocaleString()} generations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums">{fmtCents(inv.amountCents)}</span>
              {inv.status === "paid" ? (
                <Badge className="rounded-none bg-foreground text-background">PAID</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv._id)}>
                  Mark paid
                </Button>
              )}
            </div>
          </div>
        ))}
        {invoices.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No invoices yet.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export default function Admin() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <p className="studio-eyebrow">Administration Console</p>
          <h1 className="studio-serif mt-2 text-3xl tracking-tight">Platform overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Owner-only view of users, credits, the render pipeline, and enterprise
            invoicing. Every action here is scoped to your admin role server-side.
          </p>
        </div>

        <section className="mt-8">
          <StatsSection />
        </section>

        <section className="mt-10">
          <UsersSection />
        </section>

        <section className="mt-10">
          <RendersSection />
        </section>

        <section className="mt-10 pb-12">
          <InvoicesSection />
        </section>
      </main>
    </div>
  );
}
