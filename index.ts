import * as p from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ENV_FILE = join(import.meta.dir, ".env");

function saveToEnv(key: string, value: string) {
  let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8") : "";
  const lines = content.split("\n").filter((l) => !l.startsWith(`${key}=`));
  lines.push(`${key}=${value}`);
  writeFileSync(ENV_FILE, lines.filter(Boolean).join("\n") + "\n", "utf-8");
}
import { createClient, fetchOrgRepos, fetchRepoPRs, fetchRepoCommits } from "./src/github.ts";
import { computeMetrics } from "./src/metrics.ts";
import { loadCache, saveCache, cacheAge } from "./src/cache.ts";
import { saveReport } from "./src/report.ts";
import {
  printBanner,
  printSummaryBox,
  printWeeklyTrend,
  printReviewStats,
  printContributors,
  printAIInsights,
} from "./src/display.ts";
import type { RepoSummary, PRData, CommitData } from "./src/types.ts";

async function main() {
  printBanner();

  p.intro(chalk.bold.magenta(" GitAmplify — AI Amplification Analyzer "));

  // --- Load from env or prompt ---
  let token = process.env.GITHUB_TOKEN ?? "";
  let org = process.env.GITHUB_ORG ?? "";

  if (!token) {
    const input = await p.password({
      message: "GitHub Personal Access Token (PAT)",
      validate: (v) => (!v ? "Token is required" : undefined),
    });
    if (p.isCancel(input)) { p.cancel("Cancelled."); process.exit(0); }
    token = input as string;
    saveToEnv("GITHUB_TOKEN", token);
    p.log.success(chalk.dim("Token saved to .env — won't ask again"));
  } else {
    p.log.info(`Using saved token`);
  }

  if (!org) {
    const input = await p.text({
      message: "GitHub Organization or username",
      placeholder: "my-company",
      validate: (v) => (!v ? "Organization is required" : undefined),
    });
    if (p.isCancel(input)) { p.cancel("Cancelled."); process.exit(0); }
    org = input as string;
    saveToEnv("GITHUB_ORG", org);
    p.log.success(chalk.dim(`Org saved to .env — won't ask again`));
  } else {
    p.log.info(`Using saved org: ${chalk.bold(org)}`);
  }

  const rangeChoice = await p.select({
    message: "Date range to analyze",
    options: [
      { value: "30", label: "Last 30 days" },
      { value: "60", label: "Last 60 days" },
      { value: "90", label: "Last 90 days" },
      { value: "180", label: "Last 6 months" },
      { value: "365", label: "Last year" },
    ],
    initialValue: "90",
  });
  if (p.isCancel(rangeChoice)) { p.cancel("Cancelled."); process.exit(0); }

  const maxReposInput = await p.text({
    message: "Max repos to scan (leave blank for all)",
    placeholder: "all",
  });
  if (p.isCancel(maxReposInput)) { p.cancel("Cancelled."); process.exit(0); }

  const maxRepos =
    maxReposInput &&
    (maxReposInput as string).trim() !== "" &&
    (maxReposInput as string).toLowerCase() !== "all"
      ? parseInt(maxReposInput as string, 10)
      : Infinity;

  const days = parseInt(rangeChoice as string, 10);
  const until = endOfDay(new Date());
  const since = startOfDay(subDays(until, days));

  // --- Check cache ---
  let repos: RepoSummary[] = [];
  let allPRs: PRData[] = [];
  let allCommits: CommitData[] = [];
  let usedCache = false;

  const cached = loadCache(org, days);
  if (cached) {
    const useCache = await p.confirm({
      message: `Found cached data from ${cacheAge(cached.cachedAt)} — use it? ${chalk.dim("(saves API calls)")}`,
      initialValue: true,
    });
    if (p.isCancel(useCache)) { p.cancel("Cancelled."); process.exit(0); }

    if (useCache) {
      repos = cached.repos.slice(0, isFinite(maxRepos) ? maxRepos : undefined);
      allPRs = cached.prs;
      allCommits = cached.commits;
      usedCache = true;
      p.log.success(chalk.green(`Loaded from cache — ${repos.length} repos, ${allPRs.length} PRs, ${allCommits.length} commits`));
    }
  }

  if (!usedCache) {
    // --- GitHub client ---
    let activeSpinner: ReturnType<typeof ora> | null = null;
    const octokit = createClient(token, (waitSecs) => {
      activeSpinner?.stop();
      activeSpinner = null;

      const resumeAt = new Date(Date.now() + waitSecs * 1000);
      const hh = resumeAt.getHours().toString().padStart(2, "0");
      const mm = resumeAt.getMinutes().toString().padStart(2, "0");
      const mins = Math.ceil(waitSecs / 60);

      console.log();
      p.log.warn(chalk.yellow(`GitHub rate limit hit.`));
      p.log.info(`Run again after ${chalk.bold(`${hh}:${mm}`)} (${mins} min from now)`);
      p.log.info(chalk.dim(`Tip: cached data from a previous run can be reused without hitting the API.`));
      console.log();
      process.exit(1);
    });

    // --- Validate token ---
    activeSpinner = ora("Validating token and access…").start();
    try {
      try {
        await octokit.orgs.get({ org });
        activeSpinner.succeed(chalk.green(`Connected to org: ${chalk.bold(org)}`));
      } catch {
        await octokit.users.getByUsername({ username: org });
        activeSpinner.succeed(chalk.green(`Connected to user: ${chalk.bold(org)}`));
      }
    } catch (err: any) {
      activeSpinner.fail(chalk.red(`Could not find org or user "${org}": ${err.message}`));
      process.exit(1);
    }
    activeSpinner = null;

    // --- Fetch repos ---
    activeSpinner = ora("Fetching repositories…").start();
    repos = await fetchOrgRepos(octokit, org);
    repos = repos.slice(0, isFinite(maxRepos) ? maxRepos : undefined);
    activeSpinner.succeed(chalk.green(`Found ${chalk.bold(repos.length)} repos to scan`));
    activeSpinner = null;

    if (repos.length === 0) {
      p.outro(chalk.yellow("No repos found. Try a different org or wider range."));
      process.exit(0);
    }

    // --- Fetch PRs and commits ---
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const progress = `[${i + 1}/${repos.length}]`;

      activeSpinner = ora(`${progress} PRs — ${chalk.cyan(repo.name)}`).start();
      try {
        const prs = await fetchRepoPRs(octokit, org, repo.name, since, until);
        allPRs.push(...prs);
        activeSpinner.succeed(chalk.green(`${progress} ${chalk.bold(repo.name)} — ${prs.length} PRs`));
      } catch (err: any) {
        activeSpinner.warn(chalk.yellow(`${progress} ${repo.name} — PRs skipped: ${err.message}`));
      }
      activeSpinner = null;

      activeSpinner = ora(`${progress} Commits — ${chalk.cyan(repo.name)}`).start();
      try {
        const commits = await fetchRepoCommits(
          octokit, org, repo.name, since, until,
          (fetched, total) => {
            if (activeSpinner) activeSpinner.text = `${progress} Commits — ${chalk.cyan(repo.name)} ${chalk.dim(`(stats ${fetched}/${total})`)}`;
          }
        );
        allCommits.push(...commits);
        activeSpinner.succeed(chalk.green(`${progress} ${chalk.bold(repo.name)} — ${commits.length} commits`));
      } catch (err: any) {
        activeSpinner.warn(chalk.yellow(`${progress} ${repo.name} — commits skipped: ${err.message}`));
      }
      activeSpinner = null;
    }

    // --- Save cache ---
    const cacheFile = saveCache({
      cachedAt: new Date().toISOString(),
      org,
      since: since.toISOString(),
      until: until.toISOString(),
      days,
      repos,
      prs: allPRs,
      commits: allCommits,
    });
    p.log.info(chalk.dim(`Cache saved → ${cacheFile}`));
  }

  // --- Compute metrics ---
  const calcSpinner = ora("Crunching numbers…").start();
  const result = computeMetrics(org, repos, allPRs, allCommits, since, until);
  calcSpinner.succeed(chalk.green("Analysis complete"));

  console.log();

  // --- Display ---
  printSummaryBox(result);
  printWeeklyTrend(result);
  printReviewStats(result);
  printContributors(result);
  printAIInsights(result);

  // --- Save report ---
  const reportFile = saveReport(result);
  p.log.success(chalk.green(`Markdown report saved → ${chalk.bold(reportFile)}`));

  p.outro(chalk.bold.magenta(" Done! "));
}

main().catch((err) => {
  console.error(chalk.red("\nFatal error:"), err.message);
  process.exit(1);
});
