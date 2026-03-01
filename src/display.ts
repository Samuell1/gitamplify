import chalk from "chalk";
import Table from "cli-table3";
import boxen from "boxen";
import gradient from "gradient-string";
import figlet from "figlet";
import type { AnalysisResult, WeeklyBucket } from "./types.ts";

const BRAND = gradient(["#6EE7F7", "#A78BFA", "#F472B6"]);
const SUCCESS = chalk.hex("#4ADE80");
const WARN = chalk.hex("#FBBF24");
const MUTED = chalk.hex("#6B7280");
const ACCENT = chalk.hex("#818CF8");
const RED = chalk.hex("#F87171");
const CYAN = chalk.hex("#67E8F9");

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const bars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const max = Math.max(...values, 1);
  return values
    .map((v) => {
      const idx = Math.round((v / max) * (bars.length - 1));
      const bar = bars[idx];
      if (idx >= 6) return SUCCESS(bar);
      if (idx >= 3) return WARN(bar);
      return MUTED(bar);
    })
    .join("");
}

export function printBanner() {
  console.log();
  const art = figlet.textSync("GitAmplify", {
    font: "Big",
    horizontalLayout: "default",
  });
  console.log(BRAND(art));
  console.log(
    MUTED("  GitHub Org Productivity Analyzer — AI Amplification Metrics\n")
  );
}

export function printSummaryBox(result: AnalysisResult) {
  const mergeRate =
    result.totalPRsOpened > 0
      ? ((result.totalPRsMerged / result.totalPRsOpened) * 100).toFixed(1)
      : "0.0";

  const content = [
    `${ACCENT("Organization")}  ${chalk.bold.white(result.org)}`,
    `${ACCENT("Repos scanned")}  ${chalk.white(result.repoCount)}`,
    `${ACCENT("Date range")}    ${chalk.white(result.dateRange.from)} → ${chalk.white(result.dateRange.to)}`,
    "",
    `${SUCCESS("▸ PRs opened")}     ${chalk.bold.white(fmt(result.totalPRsOpened))}`,
    `${SUCCESS("▸ PRs merged")}     ${chalk.bold.white(fmt(result.totalPRsMerged))}  ${MUTED(`(${mergeRate}% merge rate)`)}`,
    `${SUCCESS("▸ Total commits")}  ${chalk.bold.white(fmt(result.totalCommits))}`,
    `${SUCCESS("▸ Lines added")}    ${chalk.bold.green("+" + fmt(result.totalLinesAdded))}`,
    `${RED("▸ Lines removed")}  ${chalk.bold.red("-" + fmt(result.totalLinesRemoved))}`,
  ].join("\n");

  console.log(
    boxen(content, {
      title: " SUMMARY ",
      titleAlignment: "center",
      padding: 1,
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: "round",
      borderColor: "magenta",
    })
  );
}

export function printWeeklyTrend(result: AnalysisResult) {
  const weeks = result.weeklyTrend;

  console.log(chalk.bold.white("  WEEKLY TREND\n"));

  const table = new Table({
    head: [
      MUTED("Week"),
      ACCENT("PRs Opened"),
      SUCCESS("PRs Merged"),
      CYAN("Commits"),
      SUCCESS("+Lines"),
      RED("-Lines"),
      MUTED("Velocity"),
    ],
    style: {
      head: [],
      border: ["grey"],
      compact: false,
    },
    colAligns: ["left", "right", "right", "right", "right", "right", "center"],
  });

  const prValues = weeks.map((w) => w.prsOpened);
  const commitValues = weeks.map((w) => w.commits);

  for (const w of weeks) {
    const velocity = w.prsMerged > 0 ? SUCCESS("●") : w.prsOpened > 0 ? WARN("◐") : MUTED("○");
    table.push([
      MUTED(w.label),
      w.prsOpened > 0 ? chalk.white(w.prsOpened) : MUTED("0"),
      w.prsMerged > 0 ? SUCCESS(w.prsMerged) : MUTED("0"),
      w.commits > 0 ? CYAN(w.commits) : MUTED("0"),
      SUCCESS("+" + fmt(w.linesAdded)),
      RED("-" + fmt(w.linesRemoved)),
      velocity,
    ]);
  }

  console.log(table.toString());

  // Sparklines
  console.log();
  console.log(
    `  ${MUTED("PR trend   ")} ${sparkline(prValues)} ${MUTED("(max: " + Math.max(...prValues, 0) + ")")}`
  );
  console.log(
    `  ${MUTED("Commit trend")} ${sparkline(commitValues)} ${MUTED("(max: " + Math.max(...commitValues, 0) + ")")}`
  );
  console.log();
}

export function printReviewStats(result: AnalysisResult) {
  const r = result.reviewStats;

  console.log(chalk.bold.white("  CODE REVIEW TURNAROUND\n"));

  const content = [
    `${ACCENT("Avg time to first review")}  ${chalk.bold.white(fmtHours(r.avgTimeToFirstReviewHours))}`,
    `${ACCENT("Avg time to merge")}         ${chalk.bold.white(fmtHours(r.avgTimeToMergeHours))}`,
    `${ACCENT("Fastest merge")}             ${SUCCESS(fmtHours(r.fastestMergeHours))}`,
    `${ACCENT("Slowest merge")}             ${WARN(fmtHours(r.slowestMergeHours))}`,
    "",
    `${SUCCESS("PRs with review")}     ${chalk.white(r.prsWithReview)}`,
    `${WARN("PRs without review")}  ${chalk.white(r.prsWithoutReview)}`,
  ].join("\n");

  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: "round",
      borderColor: "cyan",
    })
  );
}

export function printContributors(result: AnalysisResult) {
  if (result.contributors.length === 0) return;

  console.log(chalk.bold.white("  TOP CONTRIBUTORS\n"));

  const table = new Table({
    head: [
      MUTED("#"),
      ACCENT("Author"),
      ACCENT("PRs Open"),
      SUCCESS("PRs Merged"),
      CYAN("Commits"),
      SUCCESS("+Lines"),
      RED("-Lines"),
      MUTED("Avg Merge"),
    ],
    style: {
      head: [],
      border: ["grey"],
    },
    colAligns: ["right", "left", "right", "right", "right", "right", "right", "right"],
  });

  const top = result.contributors.slice(0, 15);

  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    const rank =
      i === 0
        ? chalk.bold.yellow("#1")
        : i === 1
        ? chalk.bold.hex("#C0C0C0")("#2")
        : i === 2
        ? chalk.bold.hex("#CD7F32")("#3")
        : MUTED(`#${i + 1}`);

    table.push([
      rank,
      chalk.bold.white(c.login),
      chalk.white(c.prsOpened),
      c.prsMerged > 0 ? SUCCESS(c.prsMerged) : MUTED("0"),
      c.commits > 0 ? CYAN(c.commits) : MUTED("0"),
      SUCCESS("+" + fmt(c.linesAdded)),
      RED("-" + fmt(c.linesRemoved)),
      c.avgMergeTimeHours > 0 ? MUTED(fmtHours(c.avgMergeTimeHours)) : MUTED("—"),
    ]);
  }

  console.log(table.toString());
  console.log();
}

export function printAIInsights(result: AnalysisResult) {
  const weeks = result.weeklyTrend;
  const midpoint = Math.floor(weeks.length / 2);
  const firstHalf = weeks.slice(0, midpoint);
  const secondHalf = weeks.slice(midpoint);

  const avgPRs = (half: WeeklyBucket[]) =>
    half.length === 0 ? 0 : half.reduce((s, w) => s + w.prsOpened, 0) / half.length;
  const avgCommits = (half: WeeklyBucket[]) =>
    half.length === 0 ? 0 : half.reduce((s, w) => s + w.commits, 0) / half.length;

  const prGrowth = avgPRs(firstHalf) > 0
    ? (((avgPRs(secondHalf) - avgPRs(firstHalf)) / avgPRs(firstHalf)) * 100).toFixed(1)
    : "N/A";
  const commitGrowth = avgCommits(firstHalf) > 0
    ? (((avgCommits(secondHalf) - avgCommits(firstHalf)) / avgCommits(firstHalf)) * 100).toFixed(1)
    : "N/A";

  const insights: string[] = [];

  const prNum = parseFloat(prGrowth);
  if (!isNaN(prNum)) {
    if (prNum > 20) insights.push(`${SUCCESS("↑")} PR volume grew ${SUCCESS(prGrowth + "%")} in the second half — strong momentum`);
    else if (prNum > 0) insights.push(`${WARN("↗")} PR volume grew slightly (${WARN(prGrowth + "%")}) — steady pace`);
    else insights.push(`${RED("↓")} PR volume declined ${RED(prGrowth + "%")} in the second half`);
  }

  const commitNum = parseFloat(commitGrowth);
  if (!isNaN(commitNum)) {
    if (commitNum > 20) insights.push(`${SUCCESS("↑")} Commit frequency up ${SUCCESS(commitGrowth + "%")} — devs shipping more often`);
    else if (commitNum > 0) insights.push(`${WARN("↗")} Commit frequency slightly up (${WARN(commitGrowth + "%")})`);
    else insights.push(`${RED("↓")} Commit frequency down ${RED(commitGrowth + "%")}`);
  }

  if (result.reviewStats.avgTimeToMergeHours < 24) {
    insights.push(`${SUCCESS("⚡")} Avg merge time under 24h — fast review cycle`);
  } else if (result.reviewStats.avgTimeToMergeHours > 72) {
    insights.push(`${WARN("⏳")} Avg merge time >3 days — consider streamlining reviews`);
  }

  const mergeRate = result.totalPRsOpened > 0
    ? result.totalPRsMerged / result.totalPRsOpened
    : 0;
  if (mergeRate > 0.8) insights.push(`${SUCCESS("✓")} ${(mergeRate * 100).toFixed(0)}% merge rate — very healthy PR flow`);
  else if (mergeRate < 0.4) insights.push(`${WARN("!")} ${(mergeRate * 100).toFixed(0)}% merge rate — many PRs not landing`);

  if (insights.length === 0) {
    insights.push(`${MUTED("→")} Not enough data to draw trends — try a wider date range`);
  }

  const content = insights.map((i) => `  ${i}`).join("\n");

  console.log(
    boxen(content, {
      title: " AI AMPLIFICATION INSIGHTS ",
      titleAlignment: "center",
      padding: 1,
      margin: { top: 0, bottom: 1, left: 2, right: 2 },
      borderStyle: "double",
      borderColor: "magentaBright",
    })
  );
}
