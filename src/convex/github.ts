import axios from "axios";
import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Server-side GitHub integration.
 * The token is read from process.env and NEVER sent to the client —
 * all GitHub API calls happen inside this Convex action.
 */

const GITHUB_API = "https://api.github.com";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  // Authenticated requests raise the rate limit from 60/hr to 5,000/hr.
  // Unauthenticated mode still works for public repos.
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export const getRepoStatus = action({
  args: { repo: v.string() },
  returns: v.union(
    v.object({
      fullName: v.string(),
      description: v.union(v.string(), v.null()),
      stars: v.number(),
      openIssues: v.number(),
      defaultBranch: v.string(),
      pushedAt: v.union(v.string(), v.null()),
      htmlUrl: v.string(),
      authenticated: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (_ctx, { repo }) => {
    const headers = githubHeaders();
    try {
      const res = await axios.get(`${GITHUB_API}/repos/${repo}`, {
        headers,
        timeout: 10_000,
      });
      const d = res.data;
      return {
        fullName: d.full_name as string,
        description: (d.description ?? null) as string | null,
        stars: (d.stargazers_count ?? 0) as number,
        openIssues: (d.open_issues_count ?? 0) as number,
        defaultBranch: (d.default_branch ?? "main") as string,
        pushedAt: (d.pushed_at ?? null) as string | null,
        htmlUrl: d.html_url as string,
        authenticated: Boolean(process.env.GITHUB_TOKEN),
      };
    } catch {
      return null;
    }
  },
});

export const listRecentCommits = action({
  args: { repo: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      sha: v.string(),
      message: v.string(),
      author: v.union(v.string(), v.null()),
      date: v.union(v.string(), v.null()),
      url: v.string(),
    }),
  ),
  handler: async (_ctx, { repo, limit }) => {
    const headers = githubHeaders();
    try {
      const res = await axios.get(`${GITHUB_API}/repos/${repo}/commits`, {
        headers,
        params: { per_page: Math.min(limit ?? 5, 30) },
        timeout: 10_000,
      });
      type CommitApi = {
        sha?: string;
        commit?: { message?: string; author?: { name?: string; date?: string } | null };
        html_url?: string;
      };
      const commits = (Array.isArray(res.data) ? res.data : []) as CommitApi[];
      return commits.map((c) => ({
        sha: (c.sha ?? "").slice(0, 7),
        message: (c.commit?.message ?? "").split("\n")[0],
        author: c.commit?.author?.name ?? null,
        date: c.commit?.author?.date ?? null,
        url: c.html_url ?? "",
      }));
    } catch {
      return [];
    }
  },
});
