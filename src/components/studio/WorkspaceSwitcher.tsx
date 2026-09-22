import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

/**
 * Workspace (tenant) switcher. Switching the active tenant re-points
 * `user.activeTenantId`; every tenant-scoped query is reactive to that
 * document, so assets, jobs, credits, and the gallery refresh automatically.
 */
export function WorkspaceSwitcher() {
  const current = useQuery(api.tenants.getCurrentTenant, {});
  const myTenants = useQuery(api.tenants.listMyTenants, {}) ?? [];
  const switchTenant = useMutation(api.tenants.switchTenant);

  const handleSwitch = async (tenantId: string, name: string) => {
    try {
      await switchTenant({ tenantId: tenantId as never });
      toast.success(`Switched to ${name}`, { duration: 1500 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Switch failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-2 rounded-none border-border px-3 text-xs font-normal">
          <Building2 className="size-3.5 text-muted-foreground" />
          {current ? (
            <span className="max-w-32 truncate">{current.name}</span>
          ) : (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          )}
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-none border-border">
        <DropdownMenuLabel className="studio-eyebrow text-[10px] text-muted-foreground">
          Workspace
        </DropdownMenuLabel>
        {current && (
          <>
            <div className="flex items-center justify-between px-2 py-1.5 text-xs">
              <span className="truncate">{current.name}</span>
              <span className="tabular-nums text-muted-foreground">{current.credits} cr</span>
            </div>
            <DropdownMenuSeparator className="bg-border" />
          </>
        )}
        {myTenants.length > 1 && (
          <>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">
              Switch to
            </DropdownMenuLabel>
            {myTenants
              .filter((t) => t._id !== current?._id)
              .map((t) => (
                <DropdownMenuItem
                  key={t._id}
                  className="cursor-pointer justify-between gap-2 text-xs"
                  onClick={() => handleSwitch(t._id, t.name)}
                >
                  <span className="flex items-center gap-2 truncate">
                    {t.kind === "organization" && (
                      <Building2 className="size-3 text-muted-foreground" />
                    )}
                    <span className="truncate">{t.name}</span>
                    {t.membershipRole === "owner" && (
                      <span className="text-[9px] tracking-widest text-muted-foreground">OWNER</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
                    {t.credits} cr
                    <Check className="size-3 opacity-0" />
                  </span>
                </DropdownMenuItem>
              ))}
          </>
        )}
        {myTenants.length <= 1 && (
          <p className="px-2 py-2 text-[11px] leading-5 text-muted-foreground">
            Your personal studio is your only workspace. Organization workspaces are
            assigned by the platform owner.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
