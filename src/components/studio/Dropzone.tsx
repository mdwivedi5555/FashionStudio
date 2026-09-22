import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Loader2,
  PersonStanding,
  Scan,
  Shirt,
  UploadCloud,
  Boxes,
  Plus,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AssetKind } from "@/stores/studio";

const KINDS: { id: AssetKind; label: string; icon: typeof Shirt; hint: string }[] = [
  { id: "flatlay", label: "Flat-lay", icon: Shirt, hint: "Garment on flat surface" },
  { id: "mannequin", label: "Mannequin", icon: PersonStanding, hint: "Dressed form" },
  { id: "model_face", label: "Model Ref", icon: Scan, hint: "Face / body reference" },
  { id: "render_3d", label: "3D Render", icon: Boxes, hint: "CLO / Browzwear export" },
];

export function Dropzone({ compact = false }: { compact?: boolean }) {
  const { isAuthenticated } = useAuth();
  const assets = useQuery(api.studio.listAssets, {}) ?? [];
  const register = useMutation(api.studio.registerAsset);
  const generateUploadUrl = useMutation(api.studio.generateUploadUrl);

  const [kind, setKind] = useState<AssetKind>("flatlay");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) {
            toast.error(`${file.name}: only image files are supported`);
            continue;
          }
          const uploadUrl = await generateUploadUrl({});
          const res = await fetch(uploadUrl, {
            method: "POST",
            headers: { "content-type": file.type },
            body: file,
          });
          if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
          const { storageId } = (await res.json()) as { storageId: string };
          await register({
            name: file.name,
            kind,
            storageId: storageId as never,
            sizeBytes: file.size,
            mediaType: file.type,
          });
        }
        toast.success("Assets ingested into the studio library");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl, register, kind],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Kind selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={cn(
              "studio-frame-hover flex flex-col items-start gap-1.5 border border-border bg-card p-3 text-left transition-colors",
              kind === k.id && "border-foreground/50",
            )}
          >
            <k.icon className={cn("size-4", kind === k.id ? "text-foreground" : "text-muted-foreground")} />
            <span className="text-xs font-medium">{k.label}</span>
            <span className="text-[10px] leading-tight text-muted-foreground">{k.hint}</span>
          </button>
        ))}
      </div>

      {/* Drop area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border bg-studio-canvas px-6 text-center transition-colors",
          compact ? "py-6" : "py-12",
          dragging && "border-foreground/60 bg-studio-sand",
        )}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-5 text-muted-foreground" />
        )}
        <p className="text-sm text-foreground">
          Drop {KINDS.find((k) => k.id === kind)?.label.toLowerCase()} files here
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse — routed directly to storage, never proxied
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Library strip */}
      {assets.length > 0 && (
        <div>
          <p className="studio-eyebrow mb-2">Studio Library ({assets.length})</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {assets.slice(0, 12).map((a) => (
              <div
                key={a._id}
                className="studio-frame group relative aspect-square overflow-hidden"
                title={a.name}
              >
                {a.url ? (
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                    {a.kind}
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 truncate bg-background/85 px-1.5 py-0.5 text-[9px] tracking-wide text-muted-foreground">
                  {a.kind.replace("_", " ")}
                </span>
                {isAuthenticated && (
                  <Check className="absolute right-1 top-1 hidden size-3 text-foreground group-hover:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && assets.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Plus className="size-3" /> No assets yet — ingest your first garment above.
        </p>
      )}
    </div>
  );
}
