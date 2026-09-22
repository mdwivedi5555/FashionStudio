import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  Boxes,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";
import Papa from "papaparse";

interface CsvRow {
  sku: string;
  garmentUrl: string;
  modelUrl?: string;
}

export default function Bulk() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const account = useQuery(api.studio.getAccount, {});
  const batches = useQuery(api.bulk.listBatches, {}) ?? [];
  const createBatch = useMutation(api.bulk.createBatch);
  const kickWorker = useMutation(api.studio.kickWorker);

  const [batchName, setBatchName] = useState("");
  const [engine, setEngine] = useState<"catalog" | "campaign">("catalog");
  const [pulseOn, setPulseOn] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: CsvRow[] = [];
        const problems: string[] = [];
        result.data.forEach((r, i) => {
          const sku = (r.sku ?? "").trim();
          const garmentUrl = (r.garmentUrl ?? "").trim();
          const modelUrl = (r.modelUrl ?? "").trim();
          if (!sku || !garmentUrl) {
            problems.push(`Row ${i + 2}: missing sku or garmentUrl`);
            return;
          }
          parsed.push({ sku, garmentUrl, modelUrl: modelUrl || undefined });
        });
        if (problems.length > 0) {
          toast.error(`${problems.length} problem row(s). First: ${problems[0]}`);
        }
        if (parsed.length > 0) {
          setRows(parsed);
          setFileName(file.name);
          toast.success(`${parsed.length} valid rows parsed`);
        }
      },
      error: () => toast.error("Could not parse the CSV file"),
    });
  };

  const estimate = rows.length; // 1 credit per row

  const handleSubmit = async () => {
    if (rows.length === 0) {
      toast.error("Upload a CSV first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createBatch({
        name: batchName || fileName || "Untitled batch",
        engine,
        aesthetic: pulseOn ? "prompt_pulse" : "standard",
        rows,
      });
      await kickWorker({});
      toast.success(`Batch queued — ${res.queued} looks rendering asynchronously`);
      setRows([]);
      setFileName(null);
      setBatchName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch failed to queue");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      {/* Header (shared pattern) */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo} alt="Luxemee" className="size-7" />
              <span className="studio-serif text-base tracking-wide">LUXEMEE</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
              <Link to="/dashboard" className="transition-colors hover:text-foreground">Studio</Link>
              <span className="border-b border-foreground pb-0.5 text-foreground">Bulk</span>
              <Link to="/billing" className="transition-colors hover:text-foreground">Billing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
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
          <p className="studio-eyebrow">Asynchronous Bulk Processing</p>
          <h1 className="studio-serif mt-2 text-3xl tracking-tight">Overnight batch renders</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Map hundreds of SKUs to raw asset URLs. The queue drains in the background —
            results land in your gallery without ever timing out the web client.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* CSV composer */}
          <section className="studio-frame flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="batchName" className="text-xs text-muted-foreground">Batch name</Label>
              <Input
                id="batchName"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="FW26 — Outerwear pre-collection"
                className="rounded-none border-border"
              />
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">Engine</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "catalog" as const, label: "Catalog" },
                    { id: "campaign" as const, label: "Campaign" },
                  ]
                ).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEngine(e.id)}
                    className={`border border-border bg-card py-2 text-sm transition-colors hover:border-foreground/40 ${
                      engine === e.id ? "border-foreground/50 bg-studio-sand" : ""
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-pulse flex items-center justify-between border border-border p-3">
              <div>
                <p className="text-sm font-medium">PROMPT PULSE</p>
                <p className="text-[11px] text-muted-foreground">Vintage editorial poster override</p>
              </div>
              <Switch checked={pulseOn} onCheckedChange={setPulseOn} />
            </div>

            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleCsv(f);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 border border-dashed border-border bg-studio-canvas py-10 text-center"
            >
              <FileSpreadsheet className="size-5 text-muted-foreground" />
              <p className="text-sm">{fileName ?? "Drop your CSV here"}</p>
              <p className="text-xs text-muted-foreground">
                Columns: <code className="text-foreground">sku</code>,{" "}
                <code className="text-foreground">garmentUrl</code>, optional{" "}
                <code className="text-foreground">modelUrl</code>
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCsv(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {rows.length} row{rows.length === 1 ? "" : "s"} · {estimate} credits
              </span>
              <Button onClick={handleSubmit} disabled={submitting || rows.length === 0} className="gap-2">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                Queue batch
              </Button>
            </div>
          </section>

          {/* Batch runs */}
          <section>
            <p className="studio-eyebrow mb-3">Batch Runs</p>
            {batches.length === 0 ? (
              <div className="flex flex-col items-center gap-2 border border-dashed border-border bg-studio-canvas py-16 text-center">
                <Boxes className="size-5 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">No batch runs yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {batches.map((b) => {
                  const pct = b.totalRows > 0 ? (b.processedRows / b.totalRows) * 100 : 0;
                  return (
                    <div key={b._id} className="studio-frame p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {b.engine} · {b.aesthetic === "prompt_pulse" ? "PULSE" : "standard"} ·{" "}
                            {fmt.format(b.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {b.failedRows > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                              <XCircle className="size-3" /> {b.failedRows} failed
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="rounded-none border-border text-[10px] tracking-widest"
                          >
                            {b.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={pct} className="h-1 flex-1 rounded-none" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {b.processedRows}/{b.totalRows}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
