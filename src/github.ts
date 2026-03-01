import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import type { RepoSummary, PRData, CommitData } from "./types.ts";

const ThrottledOctokit = Octokit.plugin(throttling);

export function createClient(token: string, onThrottle?: (waitSecs: number) => void) {
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, _options: any, _octokit: any, _retryCount: number) => {
        onThrottle?.(retryAfter);
        return false; // don't retry — tell the user when to come back
      },
      onSecondaryRateLimit: (retryAfter: number, _options: any, _octokit: any, _retryCount: number) => {
        onThrottle?.(retryAfter);
        return false; // don't retry
      },
    },
  });
}

export async function fetchOrgRepos(
  octokit: Octokit,
  org: string
): Promise<RepoSummary[]> {
  const repos: RepoSummary[] = [];
  let page = 1;
  let isUser = false;

  // Detect if org is actually a personal account
  try {
    await octokit.orgs.get({ org });
  } catch {
    isUser = true;
  }

  while (true) {
    let data: any[];
    if (isUser) {
      const res = await octokit.repos.listForUser({
        username: org,
        type: "all",
        per_page: 100,
        page,
      });
      data = res.data;
    } else {
      const res = await octokit.repos.listForOrg({
        org,
        type: "all",
        per_page: 100,
        page,
      });
      data = res.data;
    }

    if (data.length === 0) break;

    for (const r of data) {
      repos.push({
        name: r.name,
        fullName: r.full_name,
        isPrivate: r.private,
        defaultBranch: r.default_branch ?? "main",
        pushedAt: r.pushed_at ?? null,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return repos;
}

export async function fetchRepoPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  until: Date,
  onProgress?: (count: number) => void
): Promise<PRData[]> {
  const prs: PRData[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    let reachedOld = false;

    for (const pr of data) {
      const createdAt = new Date(pr.created_at);

      // Stop if we've gone past the start of our range
      if (createdAt < since) {
        reachedOld = true;
        break;
      }

      // Skip if after our until date
      if (createdAt > until) continue;

      // Fetch full PR detail for additions/deletions (not in list response)
      let additions = 0;
      let deletions = 0;
      let changedFiles = 0;
      try {
        const { data: detail } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: pr.number,
        });
        additions = detail.additions;
        deletions = detail.deletions;
        changedFiles = detail.changed_files;
      } catch {
        // skip if not accessible
      }

      // Fetch review info
      let firstReviewAt: string | null = null;
      let reviewCount = 0;

      try {
        const { data: reviews } = await octokit.pulls.listReviews({
          owner,
          repo,
          pull_number: pr.number,
          per_page: 100,
        });

        const submitted = reviews
          .filter((r) => r.submitted_at)
          .sort(
            (a, b) =>
              new Date(a.submitted_at!).getTime() -
              new Date(b.submitted_at!).getTime()
          );

        reviewCount = submitted.length;
        if (submitted.length > 0) {
          firstReviewAt = submitted[0].submitted_at ?? null;
        }
      } catch {
        // reviews not accessible, skip
      }

      prs.push({
        number: pr.number,
        title: pr.title,
        state: pr.state as "open" | "closed",
        createdAt: pr.created_at,
        mergedAt: pr.merged_at ?? null,
        closedAt: pr.closed_at ?? null,
        additions,
        deletions,
        changedFiles,
        user: pr.user?.login ?? "unknown",
        repoName: repo,
        firstReviewAt,
        reviewCount,
      });

      onProgress?.(prs.length);
    }

    if (reachedOld || data.length < 100) break;
    page++;
  }

  return prs;
}

export async function fetchRepoCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  until: Date,
  onProgress?: (fetched: number, total: number) => void
): Promise<CommitData[]> {
  const commits: CommitData[] = [];
  let page = 1;

  // Step 1: list all commits in range
  while (true) {
    let data: any[];
    try {
      const res = await octokit.repos.listCommits({
        owner,
        repo,
        since: since.toISOString(),
        until: until.toISOString(),
        per_page: 100,
        page,
      });
      data = res.data;
    } catch {
      break; // empty repo or no access
    }

    if (data.length === 0) break;

    for (const c of data) {
      commits.push({
        sha: c.sha,
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
        author: c.author?.login ?? c.commit.author?.name ?? "unknown",
        message: c.commit.message.split("\n")[0],
        repoName: repo,
        additions: 0,
        deletions: 0,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  // Step 2: fetch per-commit stats in batches of 5
  const BATCH = 5;
  for (let i = 0; i < commits.length; i += BATCH) {
    const batch = commits.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const { data: detail } = await octokit.repos.getCommit({
            owner,
            repo,
            ref: c.sha,
          });
          c.additions = detail.stats?.additions ?? 0;
          c.deletions = detail.stats?.deletions ?? 0;
        } catch {
          // skip if not accessible
        }
      })
    );
    onProgress?.(Math.min(i + BATCH, commits.length), commits.length);
  }

  return commits;
}
