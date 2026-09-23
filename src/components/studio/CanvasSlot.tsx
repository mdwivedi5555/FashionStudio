import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { StudioAsset } from "@/stores/studio";
import { Check, ImageOff, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CanvasSlotProps {
  label: string;
  asset: StudioAsset | null;
  pool: StudioAsset[];
  icon: typeof Check;
  onSelect: (a: StudioAsset | null) => void;
}

export function CanvasSlot({ label, asset, pool, icon: Icon, onSelect }: CanvasSlotProps) {
  const [open, setOpen] = useState(false);

  const assign = (a: StudioAsset) => {
    onSelect(a);
    setOpen(false);
    toast(`Assigned to ${label} slot`, { duration: 1200 });
  };

  const clear = () => {
    onSelect(null);
    setOpen(false);
    toast(`Cleared ${label} slot`, { duration: 1200 });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} slot — click to choose an asset`}
          title={
            asset
              ? `${asset.name} — click to change, × to clear`
              : `${label} — click to choose from library`
          }
          className={cn(
            "studio-frame flex w-full items-center gap-4 p-3 text-left transition-colors hover:border-foreground/40",
            "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
          )}
        >
          <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-studio-canvas">
            {asset?.url ? (
              <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
            ) : (
              <Icon className="size-6 text-muted-foreground/50" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="studio-eyebrow block">{label}</span>
            <span className="block truncate text-sm">{asset ? asset.name : "Empty slot"}</span>
            <span className="block text-[11px] text-muted-foreground">
              {asset
                ? "Click to change · × to clear"
                : `${pool.length} candidate${pool.length === 1 ? "" : "s"} in library${pool.length === 0 ? " — ingest assets below" : ""}`}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[calc(100vw-3rem)] max-w-96 rounded-none border-border p-3"
      >
        <p className="studio-eyebrow mb-2">{label} — choose from library</p>
        {pool.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 border border-dashed border-border bg-studio-canvas px-4 py-6 text-center">
            <ImageOff className="size-4 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              No candidates yet. Upload a compatible asset in Asset Ingestion first.
            </p>
          </div>
        ) : (
          <div className="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto">
            {pool.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                onClick={() => assign(a)}
                className={cn(
                  "studio-frame-hover relative aspect-square overflow-hidden border bg-card transition-colors",
                  asset?.id === a.id ? "border-foreground" : "border-border",
                )}
              >
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                {asset?.id === a.id && (
                  <span className="absolute left-0.5 top-0.5 bg-foreground p-0.5">
                    <Check className="size-2.5 text-background" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {asset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="mt-2 w-full gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" /> Clear this slot
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
