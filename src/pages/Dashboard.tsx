import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dropzone } from "@/components/studio/Dropzone";
import { PipelineControls } from "@/components/studio/PipelineControls";
import { RepoPanel } from "@/components/studio/RepoPanel";
import { WorkspaceSwitcher } from "@/components/studio/WorkspaceSwitcher";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useStudioStore, type StudioAsset } from "@/stores/studio";
import { useMutation, useQuery } from "convex/react";
import {
  Boxes,
  CheckCircle2,
  CircleDashed,
  Loader2,
  LogOut,
  Receipt,
  Scan,
  Shirt,
  Sparkles,
  TriangleAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";

function StatusBadge({ status, engineUsed }: { status: string; engineUsed?: string }) {
  const map: Record<string, { label: string; cls: string; icon: typeof Loader2 }> = {
    queued: { label: "Queued", cls: "text-muted-foreground", icon: CircleDashed },
    processing: { label: "Rendering", cls: "text-foreground", icon: Loader2 },
    done: { label: engineUsed ? `Done · ${engineUsed}` : "Done", cls: "text-foreground", icon: CheckCircle2 },
    failed: { label: "Failed", cls: "text-destructive", icon: XCircle },
  };
  const m = map[status] ?? map.queued;
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] tracking-wide", m.cls)}>
      <Icon className={cn("size-3", status === "processing" && "animate-spin")} />
      {m.label}
    </span>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const account = useQuery(api.studio.getAccount, {});
  const assets = useQuery(api.studio.listAssets, {}) ?? [];
  const jobs = useQuery(api.studio.listJobs, {}) ?? [];
  const bootstrap = useMutation(api.studio.bootstrapAccount);

  const {
    selectedGarment,
    selectedModel,
    selectGarment,
    selectModel,
    promptPulseOn,
  } = useStudioStore();

  // Self-heal: ensure the free account exists on first dashboard visit.
  useEffect(() => {
    if (account === null) {
      bootstrap({}).catch(() => undefined);
    }
  }, [account, bootstrap]);

  const library: StudioAsset[] = useMemo(
    () =>
      assets
        .filter((a) => a.url)
        .map((a) => ({
          id: a._id,
          name: a.name,
          kind: a.kind as StudioAsset["kind"],
          url: a.url as string,
        })),
    [assets],
  );

  const garmentPool = library.filter((a) => a.kind !== "model_face");
  const modelPool = library.filter((a) => a.kind === "model_face");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const doneJobs = jobs.filter((j) => j.status === "done");
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "processing");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="Luxemee" className="size-7" />
              <span className="studio-serif text-base tracking-wide">LUXEMEE</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
              <span className="border-b border-foreground pb-0.5 text-foreground">Studio</span>
              <Link to="/bulk" className="transition-colors hover:text-foreground">Bulk</Link>
              <Link to="/billing" className="transition-colors hover:text-foreground">Billing</Link>
              {user?.role === "admin" && (
                <Link to="/admin" className="transition-colors hover:text-foreground">Admin</Link>
              )}
            </nav>
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
        {/* Heading */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="studio-eyebrow">The Image Engine — Phase 1</p>
            <h1 className="studio-serif mt-2 text-3xl tracking-tight">
              Good to see you{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {activeJobs.length > 0
              ? `${activeJobs.length} look${activeJobs.length === 1 ? "" : "s"} in the pipeline`
              : "Pipeline idle — queue a look to begin"}
          </p>
        </div>

        {/* Workspace grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* Left rail — controls */}
          <aside className="flex flex-col gap-8">
            <PipelineControls />
          </aside>

          {/* Right — ingestion + slots + gallery */}
          <div className="flex flex-col gap-10">
            {/* Repository & CI status */}
            <RepoPanel />
            {/* Asset slots */}
            <section>
              <div className="flex items-center justify-between">
                <p className="studio-eyebrow">Canvas Slots</p>
                <span className="text-[11px] text-muted-foreground">
                  Click a library tile to assign
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { key: "garment", label: "Garment", asset: selectedGarment, pool: garmentPool, icon: Shirt },
                    { key: "model", label: "Model Ref", asset: selectedModel, pool: modelPool, icon: Scan },
                  ] as const
                ).map((slot) => (
                  <div key={slot.key} className="studio-frame flex items-center gap-4 p-3">
                    <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-studio-canvas">
                      {slot.asset?.url ? (
                        <img src={slot.asset.url} alt={slot.asset.name} className="h-full w-full object-cover" />
                      ) : (
                        <slot.icon className="size-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="studio-eyebrow">{slot.label}</p>
                      <p className="truncate text-sm">
                        {slot.asset ? slot.asset.name : "Empty slot"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {slot.pool.length} candidate{slot.pool.length === 1 ? "" : "s"} in library
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ingestion */}
            <section>
              <div className="flex items-center justify-between">
                <p className="studio-eyebrow">Asset Ingestion</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Boxes className="size-3" /> 3D renders supported
                </span>
              </div>
              <div className="mt-3">
                <Dropzone compact />
              </div>
            </section>

            {/* Library — clickable to assign slots */}
            {library.length > 0 && (
              <section>
                <p className="studio-eyebrow mb-3">Library</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {library.map((a) => {
                    const isGarment = selectedGarment?.id === a.id;
                    const isModel = selectedModel?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        title={`${a.name} — click: garment slot, shift-click: model slot`}
                        onClick={(e) => {
                          if (a.kind === "model_face" || e.shiftKey) {
                            selectModel(a);
                            toast("Assigned to Model Ref slot", { duration: 1200 });
                          } else {
                            selectGarment(a);
                            toast("Assigned to Garment slot", { duration: 1200 });
                          }
                        }}
                        className={cn(
                          "studio-frame-hover relative aspect-square overflow-hidden border bg-card transition-colors",
                          (isGarment || isModel) ? "border-foreground" : "border-border",
                        )}
                      >
                        <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                        {isGarment && (
                          <span className="absolute left-1 top-1 bg-foreground px-1 py-0.5 text-[8px] tracking-widest text-background">
                            G
                          </span>
                        )}
                        {isModel && (
                          <span className="absolute left-1 top-1 bg-foreground px-1 py-0.5 text-[8px] tracking-widest text-background">
                            M
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <Separator className="bg-border/70" />

            {/* Queue */}
            <section>
              <p className="studio-eyebrow mb-3">Render Queue</p>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing queued yet — configure the panel and render your first look.
                </p>
              ) : (
                <div className="divide-y divide-border/70 border border-border">
                  {jobs.slice(0, 6).map((j) => (
                    <div key={j._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <StatusBadge status={j.status} engineUsed={j.engineUsed} />
                        <span className="truncate text-xs text-muted-foreground">
                          {j.sku ? `SKU ${j.sku}` : "Single look"}
                          {j.aesthetic === "prompt_pulse" ? " · PULSE" : ""}
                        </span>
                      </div>
                      {j.status === "failed" && (
                        <span title={j.error} className="inline-flex">
                          <TriangleAlert className="size-3.5 shrink-0 text-destructive" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Gallery */}
            <section>
              <div className="flex items-center justify-between">
                <p className="studio-eyebrow">Render Gallery</p>
                <span className="text-[11px] text-muted-foreground">{doneJobs.length} finished</span>
              </div>
              {doneJobs.length === 0 ? (
                <div className="mt-3 flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-studio-canvas py-14 text-center">
                  <Upload className="size-5 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">Finished looks will hang here.</p>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {doneJobs.map((j) => (
                    <figure key={j._id} className="studio-frame studio-frame-hover p-2">
                      <div className="studio-pulse relative aspect-[3/4] overflow-hidden">
                        {j.resultUrl && (
                          <img
                            src={j.resultUrl}
                            alt={j.sku ?? "Rendered look"}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <figcaption className="mt-2 flex items-center justify-between px-0.5 pb-0.5">
                        <span className="truncate text-[10px] tracking-[0.14em] text-muted-foreground">
                          {(j.sku ?? "LOOK").toUpperCase()}
                        </span>
                        <StatusBadge status={j.status} engineUsed={j.engineUsed} />
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Enterprise hint */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-2">
            <Receipt className="size-3.5" />
            Processing at wholesale volume? Net-30 corporate invoicing is available in Billing.
          </p>
          <Link to="/billing" className="underline underline-offset-4 hover:text-foreground">
            Open Billing
          </Link>
        </div>
      </footer>
    </div>
  );
}
