import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/stores/studio";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Sparkles, Wand2, Zap } from "lucide-react";
import { toast } from "sonner";
import { LIGHTING_PRESETS } from "@/convex/engineConfig";

const ENGINES = [
  {
    id: "catalog" as const,
    name: "Catalog",
    desc: "FASHN v1.6-class — fabric-true PDP renders",
  },
  {
    id: "campaign" as const,
    name: "Campaign",
    desc: "FLUX VTON Pro-class — prompt-directed styling",
  },
];

const RENDER_ANGLES = [
  { id: "flat", label: "Flat-lay" },
  { id: "front", label: "Front" },
  { id: "turn", label: "3/4 Turn" },
  { id: "motion", label: "In Motion" },
];

export function PipelineControls() {
  const { user } = useAuth();
  const account = useQuery(api.studio.getAccount, {});
  const createJob = useMutation(api.studio.createJob);
  const kickWorker = useMutation(api.studio.kickWorker);

  const {
    selectedGarment,
    selectedModel,
    engine,
    setEngine,
    promptPulseOn,
    togglePromptPulse,
    renderId,
    setRenderId,
    lighting,
    setLighting,
    stylePrompt,
    setStylePrompt,
    applyPreset,
  } = useStudioStore();

  const handleGenerate = async () => {
    if (!selectedGarment) {
      toast.error("Select a garment asset from the library first");
      return;
    }
    try {
      await createJob({
        garmentUrl: selectedGarment.url,
        modelUrl: selectedModel?.url,
        engine,
        aesthetic: promptPulseOn ? "prompt_pulse" : "standard",
        lighting,
        stylePrompt: stylePrompt || undefined,
      });
      await kickWorker({});
      toast.success("Queued — the pipeline is rendering your look");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue job");
    }
  };

  const credits = account?.credits ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Engine */}
      <section>
        <p className="studio-eyebrow mb-2">Engine</p>
        <div className="grid grid-cols-2 gap-2">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEngine(e.id)}
              className={cn(
                "studio-frame-hover border border-border bg-card p-3 text-left",
                engine === e.id && "border-foreground/50",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {e.id === "catalog" ? <Zap className="size-3.5" /> : <Wand2 className="size-3.5" />}
                {e.name}
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">{e.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* PROMPT PULSE */}
      <section className="studio-pulse border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-3.5" /> PROMPT PULSE
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              Vintage editorial poster art override for luxury campaigns
            </p>
          </div>
          <Switch checked={promptPulseOn} onCheckedChange={togglePromptPulse} />
        </div>
      </section>

      {/* Render angle */}
      <section>
        <p className="studio-eyebrow mb-2">Render Angle</p>
        <div className="grid grid-cols-4 gap-2">
          {RENDER_ANGLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRenderId(r.id)}
              className={cn(
                "border border-border bg-card py-2 text-xs transition-colors hover:border-foreground/40",
                renderId === r.id && "border-foreground/50 bg-studio-sand",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* Lighting */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="studio-eyebrow">Lighting</p>
          <div className="flex gap-1">
            {LIGHTING_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className="border border-border bg-card px-1.5 py-0.5 text-[9px] tracking-wide text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 pt-1">
          <div>
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs text-muted-foreground">Key intensity</Label>
              <span className="text-muted-foreground">{lighting.keyIntensity}</span>
            </div>
            <Slider
              value={[lighting.keyIntensity]}
              onValueChange={([v]) => setLighting({ keyIntensity: v })}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs text-muted-foreground">Fill ratio</Label>
              <span className="text-muted-foreground">{lighting.fillRatio}:1</span>
            </div>
            <Slider
              value={[lighting.fillRatio]}
              onValueChange={([v]) => setLighting({ fillRatio: v })}
              min={1}
              max={6}
              step={1}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs text-muted-foreground">Warmth</Label>
              <span className="text-muted-foreground">{lighting.warmth}</span>
            </div>
            <Slider
              value={[lighting.warmth]}
              onValueChange={([v]) => setLighting({ warmth: v })}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>
      </section>

      {/* Style prompt */}
      <section>
        <p className="studio-eyebrow mb-2">Art Direction</p>
        <Textarea
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          placeholder='e.g. "tucked in", "flowing in the wind", "seated on a linen chaise"'
          className="min-h-20 resize-none rounded-none border-border text-sm"
        />
      </section>

      {/* Generate */}
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleGenerate}
          disabled={!selectedGarment || (account !== undefined && credits < 1)}
          className="w-full gap-2"
        >
          {account === undefined ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Render look — 1 credit
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Balance: <span className="text-foreground">{credits}</span> credits
          {user?.name ? "" : ""}
        </p>
      </div>
    </div>
  );
}
