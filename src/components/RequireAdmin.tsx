import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * Owner/developer-only route guard. Requires authentication AND the
 * "admin" role on the user record. Non-admins see a quiet denial panel
 * rather than the app content.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (user && user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="studio-frame max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto size-6 text-muted-foreground" />
          <h1 className="studio-serif mt-4 text-xl">Restricted</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The administration console is available to platform owners only.
            If this is your studio, add your account email to the{" "}
            <code className="text-foreground">ADMIN_EMAILS</code> key and sign in
            again.
          </p>
        </div>
      </main>
    );
  }

  return children;
}
