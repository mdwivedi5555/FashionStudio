import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { CircleCheck, CircleDashed, Github, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface RepoStatus {
  fullName: string;
  description: string | null;
  stars: number;
  openIssues: number;
  defaultBranch: string;
  pushedAt: string | null;
  htmlUrl: string;
  authenticated: boolean;
}

interface CommitRow {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

/**
 * Compact repository & CI status panel.
 * All GitHub API calls run server-side via the Convex action; the token
 * never reaches the client.
 */
export function RepoPanel() {
  const [repo, setRepo] = useState("owner/luxemee-studio");
  const [status, setStatus] = useState<RepoStatus | null | undefined>(undefined);
  const [commits, setCommits] = useState<CommitRow[]>([]);

  const getRepoStatus = useAction(api.github.getRepoStatus);
  const listRecentCommits = useAction(api.github.listRecentCommits);

  useEffect(() => {
    const trimmed = repo.trim();
    if (!trimmed.includes("/")) return;
    let cancelled = false;
    setStatus(undefined);
    setCommits([]);
    void (async () => {
      try {
        const [s, c] = await Promise.all([
          getRepoStatus({ repo: trimmed }),
          listRecentCommits({ repo: trimmed, limit: 3 }),
        ]);
        if (cancelled) return;
        setStatus(s);
        setCommits(c);
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, getRepoStatus, listRecentCommits]);

  return (
    <div className="studio-frame p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Github className="size-4" /> Repository &amp; CI
        </p>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          spellCheck={false}
          className="w-44 rounded-none border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40"
          aria-label="GitHub repository slug"
        />
      </div>

      {status === undefined ? (
        <p className="mt-4 text-xs text-muted-foreground">Loading repository status…</p>
      ) : status === null ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Repository not reachable — check the slug, or that the repo exists and the
          token (if private) has read access. CI still gates every push via the
          workflow file.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <a
              href={status.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {status.fullName}
            </a>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {status.stars}
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleCheck className="size-3 text-studio-gold" />
              CI: typecheck + lint gate
            </span>
            <span className="inline-flex items-center gap-1">
              <CircleDashed className="size-3" />
              {status.pushedAt
                ? `last push ${new Date(status.pushedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                : "no pushes yet"}
            </span>
          </div>
          {commits.length > 0 && (
            <div className="divide-y divide-border/70 border border-border">
              {commits.map((c) => (
                <a
                  key={c.sha}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs transition-colors hover:bg-studio-sand"
                >
                  <span className="truncate text-muted-foreground">{c.message}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground/70">{c.sha}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
