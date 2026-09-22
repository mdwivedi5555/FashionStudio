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
  Plus,
  Receipt,
  Users,
  UserPlus,
  UserMinus,
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
      <StatCard label="Tenants" value={String(stats.totalTenants)} icon={Building2} />
      <StatCard label="Organizations" value={String(stats.orgTenants)} icon={Building2} />
      <StatCard label="Enterprise" value={String(stats.enterpriseTenants)} icon={Building2} />
      <StatCard label="Renders" value={String(stats.totalJobs)} icon={Activity} />
      <StatCard label="In pipeline" value={String(stats.activeJobs)} icon={Activity} />
      <StatCard label="Failure rate" value={`${stats.failureRatePct}%`} icon={Activity} />
      <StatCard label="Credits out" value={String(stats.creditsInCirculation)} icon={Coins} />
      <StatCard label="Revenue" value={fmtCents(stats.revenueCents)} icon={Receipt} />
      <StatCard label="Outstanding" value={fmtCents(stats.outstandingCents)} icon={Receipt} />
      <StatCard label="Memberships" value={String(stats.totalMemberships)} icon={Users} />
      <StatCard label="Batches" value={String(stats.totalBatches)} icon={Activity} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenants — organizations & workspaces
// ---------------------------------------------------------------------------

interface TenantMemberRow {
  userId: string;
  role: string;
  email: string;
}

interface TenantRow {
  _id: string;
  name: string;
  slug: string;
  kind: string;
  credits: number;
  plan: string;
  enterprise: boolean;
  memberCount: number;
  members: TenantMemberRow[];
  jobCount: number;
  createdAt: number;
}

export function TenantsSection() {
  const tenants = useQuery(api.admin.listTenants, {}) ?? [];
  const createTenant = useMutation(api.admin.createTenant);
  const grantTenantCredits = useMutation(api.admin.grantTenantCredits);
  const setTenantEnterprise = useMutation(api.admin.setTenantEnterprise);
  const addTenantMember = useMutation(api.admin.addTenantMember);
  const removeTenantMember = useMutation(api.admin.removeTenantMember);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [creditPanelFor, setCreditPanelFor] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("500");
  const [creditReason, setCreditReason] = useState("Contract top-up");

  const [memberPanelFor, setMemberPanelFor] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "member">("member");

  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Give the tenant a name");
      return;
    }
    setCreating(true);
    try {
      await createTenant({ name: newName.trim(), kind: "organization" });
      toast.success(`Tenant "${newName.trim()}" created`);
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleGrant = async (tenantId: string) => {
    setBusy(true);
    try {
      await grantTenantCredits({
        tenantId: tenantId as never,
        amount: Number(creditAmount) || 0,
        reason: creditReason || "Admin grant",
      });
      toast.success(`Granted ${creditAmount} credits`);
      setCreditPanelFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnterprise = async (t: TenantRow) => {
    try {
      await setTenantEnterprise({ tenantId: t._id as never, enterprise: !t.enterprise });
      toast.success(t.enterprise ? "Enterprise revoked" : "Enterprise access granted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleAddMember = async (tenantId: string) => {
    if (!memberEmail.trim()) {
      toast.error("Enter the member's email");
      return;
    }
    setBusy(true);
    try {
      await addTenantMember({
        tenantId: tenantId as never,
        email: memberEmail.trim(),
        role: memberRole,
      });
      toast.success(`${memberEmail.trim()} added as ${memberRole}`);
      setMemberEmail("");
      setMemberPanelFor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add member failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (tenantId: string, userId: string) => {
    try {
      await removeTenantMember({ tenantId: tenantId as never, userId: userId as never });
      toast.success("Member removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create tenant */}
      <div className="studio-frame flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-48">
          <p className="mb-1 text-xs text-muted-foreground">New organization tenant</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Maison Verre — EU wholesale"
            className="rounded-none"
          />
        </div>
        <Button disabled={creating} onClick={handleCreate} className="gap-2">
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create tenant
        </Button>
      </div>

      {/* Tenant cards */}
      {tenants.map((t) => (
        <div key={t._id} className="studio-frame">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="size-4 text-muted-foreground" />
                {t.name}
                <span className="text-[10px] tracking-widest text-muted-foreground">
                  {t.kind.toUpperCase()}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t.slug} · {t.credits} credits · {t.jobCount} renders · {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {t.enterprise && (
                <Badge variant="outline" className="rounded-none border-studio-gold text-[10px] tracking-widest">
                  ENTERPRISE
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={() => setCreditPanelFor(creditPanelFor === t._id ? null : t._id)}>
                <Coins className="mr-1 size-3.5" /> Credits
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMemberPanelFor(memberPanelFor === t._id ? null : t._id)}>
                <UserPlus className="mr-1 size-3.5" /> Add member
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleToggleEnterprise(t)}>
                {t.enterprise ? "Revoke ent." : "Grant ent."}
              </Button>
            </div>
          </div>

          {/* Members list */}
          {t.members.length > 0 && (
            <div className="divide-y divide-border/70">
              {t.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-3 px-5 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs">{m.email}</span>
                    {m.role === "owner" && (
                      <Badge variant="outline" className="rounded-none border-border text-[9px] tracking-widest">
                        OWNER
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(t._id, m.userId)}
                  >
                    <UserMinus className="size-3" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Inline credit panel */}
          {creditPanelFor === t._id && (
            <div className="flex flex-wrap items-end gap-3 border-t border-border bg-studio-sand px-5 py-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Amount</p>
                <Input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-24 rounded-none" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Reason</p>
                <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} className="w-52 rounded-none" />
              </div>
              <Button size="sm" disabled={busy} onClick={() => handleGrant(t._id)}>Grant to tenant pool</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreditPanelFor(null)}>Cancel</Button>
            </div>
          )}

          {/* Inline add-member panel */}
          {memberPanelFor === t._id && (
            <div className="flex flex-wrap items-end gap-3 border-t border-border bg-studio-sand px-5 py-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Member email (must be registered)</p>
                <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="member@brand.com" className="w-60 rounded-none" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Role</p>
                <div className="flex gap-1">
                  {(["member", "owner"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMemberRole(r)}
                      className={`border px-3 py-1.5 text-xs capitalize transition-colors ${
                        memberRole === r ? "border-foreground/50 bg-card" : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <Button size="sm" disabled={busy} onClick={() => handleAddMember(t._id)}>Add member</Button>
              <Button size="sm" variant="ghost" onClick={() => setMemberPanelFor(null)}>Cancel</Button>
            </div>
          )}
        </div>
      ))}

      {tenants.length === 0 && (
        <p className="studio-frame px-5 py-10 text-center text-sm text-muted-foreground">
          No tenants yet — create the first organization above.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface UserRow {
  _id: string;
  email: string | null;
  name: string | null;
  role: string;
  isAnonymous: boolean;
  tenants: { tenantId: string; name: string; role: string }[];
}

export function UsersSection() {
  const users = useQuery(api.admin.listUsers, {}) ?? [];
  const setRole = useMutation(api.admin.setUserRole);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRole = async (userId: string, role: "admin" | "user") => {
    setBusyId(userId);
    try {
      await setRole({ userId: userId as never, role });
      toast.success(role === "admin" ? "Promoted to admin" : "Demoted to user");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="studio-frame divide-y divide-border/70">
      <div className="grid grid-cols-12 gap-2 border-b border-border/70 px-5 py-2.5 studio-eyebrow">
        <span className="col-span-4">User</span>
        <span className="col-span-5">Tenants</span>
        <span className="col-span-3 text-right">Platform role</span>
      </div>
      {users.map((u) => (
        <div key={u._id} className="grid grid-cols-12 items-center gap-2 px-5 py-2.5 text-xs">
          <div className="col-span-4 truncate">
            {u.email ?? (u.isAnonymous ? "guest (anonymous)" : "unknown")}
            {u.role === "admin" && (
              <Badge variant="outline" className="ml-2 rounded-none border-studio-gold text-[9px] tracking-widest">ADMIN</Badge>
            )}
          </div>
          <div className="col-span-5 truncate text-muted-foreground">
            {u.tenants.length === 0
              ? "—"
              : u.tenants.map((t) => `${t.name}${t.role === "owner" ? " (owner)" : ""}`).join(", ")}
          </div>
          <div className="col-span-3 flex justify-end">
            {busyId === u._id ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : u.role === "admin" ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => handleRole(u._id, "user")}>
                Demote
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => handleRole(u._id, "admin")}>
                Promote
              </Button>
            )}
          </div>
        </div>
      ))}
      {users.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No registered users yet.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent renders — cross-tenant pipeline feed
// ---------------------------------------------------------------------------

interface RenderRow {
  _id: string;
  email: string | null;
  tenantName: string;
  sku: string | null;
  engine: string;
  engineUsed: string | null;
  aesthetic: string;
  status: string;
  error: string | null;
  costCredits: number;
  createdAt: number;
}

export function RendersSection() {
  const renders = useQuery(api.admin.listRecentJobs, {}) ?? [];

  return (
    <div className="studio-frame divide-y divide-border/70">
      {renders.map((r) => (
        <div key={r._id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-muted-foreground">{r.tenantName}</span>
            <span className="truncate">{r.email ?? "guest"}</span>
            {r.sku && <span className="text-muted-foreground">{r.sku}</span>}
            <span className="tracking-wide">{r.engine}</span>
            {r.aesthetic === "prompt_pulse" && <span className="studio-gold-text text-[10px] tracking-widest">PULSE</span>}
            {r.error && <span className="truncate text-destructive">{r.error}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
            <span>−{r.costCredits} cr</span>
            <span>{r.engineUsed ?? "—"}</span>
            <span
              className={
                r.status === "done"
                  ? "text-emerald-700"
                  : r.status === "failed"
                    ? "text-destructive"
                    : "text-amber-700"
              }
            >
              {r.status.toUpperCase()}
            </span>
            <span className="tabular-nums">{new Date(r.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
      {renders.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No renders yet.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoices — enterprise net-30 oversight
// ---------------------------------------------------------------------------

interface InvoiceRow {
  _id: string;
  number: string;
  tenantName: string;
  periodLabel: string;
  generationCount: number;
  amountCents: number;
  status: string;
  dueAt: number;
  settledVia: string | null;
}

export function InvoicesSection() {
  const invoices = useQuery(api.admin.listAllInvoices, {}) ?? [];
  const markPaid = useMutation(api.admin.markInvoicePaid);

  return (
    <div className="studio-frame divide-y divide-border/70">
      {invoices.map((inv) => (
        <div key={inv._id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-xs">
          <div className="flex min-w-0 items-center gap-3">
            <span className="tracking-wide">{inv.number}</span>
            <span className="truncate text-muted-foreground">{inv.tenantName}</span>
            <span className="text-muted-foreground">{inv.periodLabel} · {inv.generationCount} renders</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="tabular-nums">{fmtCents(inv.amountCents)}</span>
            <span className={inv.status === "paid" ? "text-emerald-700" : "text-amber-700"}>
              {inv.status.toUpperCase()}
            </span>
            {inv.status !== "paid" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => markPaid({ invoiceId: inv._id as never, settledVia: "Corporate bank transfer" })}
              >
                Mark paid
              </Button>
            )}
            <span className="text-muted-foreground tabular-nums">due {new Date(inv.dueAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
      {invoices.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices issued.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: string }) {
  return <h2 className="studio-serif mt-10 mb-3 text-lg first:mt-0">{children}</h2>;
}

export default function Admin() {
  const me = useQuery(api.admin.getMe, {});

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Verifying owner credentials…
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="studio-eyebrow">Restricted</p>
        <p className="studio-serif max-w-md text-2xl">This console is reserved for platform owners.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Add your account email to the <code className="border border-border bg-card px-1">ADMIN_EMAILS</code> key
          in the Keys tab, then sign in again to be promoted automatically.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/dashboard">Return to Studio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-studio-sand pb-24">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-6 pt-10">
        <p className="studio-eyebrow">Owner Console</p>
        <h1 className="studio-serif mt-1 text-3xl">Platform Administration</h1>

        <SectionTitle>Overview</SectionTitle>
        <StatsSection />

        <SectionTitle>Tenants</SectionTitle>
        <TenantsSection />

        <SectionTitle>Users</SectionTitle>
        <UsersSection />

        <SectionTitle>Recent renders</SectionTitle>
        <RendersSection />

        <SectionTitle>Enterprise invoices</SectionTitle>
        <InvoicesSection />
      </main>
    </div>
  );
}
