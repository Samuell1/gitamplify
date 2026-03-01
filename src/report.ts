import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { format } from "date-fns";
import type { AnalysisResult, WeeklyBucket } from "./types.ts";

const REPORTS_DIR = join(import.meta.dir, "..", "reports");

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function num(n: number): string {
  return n.toLocaleString("en-US");
}

export function generateMarkdownReport(result: AnalysisResult): string {
  const now = format(new Date(), "MMMM d, yyyy 'at' HH:mm");
  const mergeRate =
    result.totalPRsOpened > 0
      ? ((result.totalPRsMerged / result.totalPRsOpened) * 100).toFixed(1)
      : "0.0";

  const lines: string[] = [];

  // Header
  lines.push(`# GitAmplify Report — \`${result.org}\``);
  lines.push(``);
  lines.push(`**Date range:** ${result.dateRange.from} → ${result.dateRange.to}`);
  lines.push(`**Repos scanned:** ${result.repoCount}`);
  lines.push(`**Generated:** ${now}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Summary
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| PRs Opened | ${num(result.totalPRsOpened)} |`);
  lines.push(`| PRs Merged | ${num(result.totalPRsMerged)} (${mergeRate}% merge rate) |`);
  lines.push(`| Total Commits | ${num(result.totalCommits)} |`);
  lines.push(`| Lines Added | +${num(result.totalLinesAdded)} |`);
  lines.push(`| Lines Removed | -${num(result.totalLinesRemoved)} |`);
  lines.push(`| Net Lines | ${result.totalLinesAdded - result.totalLinesRemoved >= 0 ? "+" : ""}${num(result.totalLinesAdded - result.totalLinesRemoved)} |`);
  lines.push(``);

  // Code review
  lines.push(`## Code Review Turnaround`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Avg time to first review | ${fmtHours(result.reviewStats.avgTimeToFirstReviewHours)} |`);
  lines.push(`| Avg time to merge | ${fmtHours(result.reviewStats.avgTimeToMergeHours)} |`);
  lines.push(`| Fastest merge | ${fmtHours(result.reviewStats.fastestMergeHours)} |`);
  lines.push(`| Slowest merge | ${fmtHours(result.reviewStats.slowestMergeHours)} |`);
  lines.push(`| PRs with review | ${result.reviewStats.prsWithReview} |`);
  lines.push(`| PRs without review | ${result.reviewStats.prsWithoutReview} |`);
  lines.push(``);

  // Weekly trend
  lines.push(`## Weekly Trend`);
  lines.push(``);
  lines.push(`| Week | PRs Opened | PRs Merged | Commits | +Lines | -Lines |`);
  lines.push(`|------|-----------|-----------|---------|--------|--------|`);
  for (const w of result.weeklyTrend) {
    lines.push(
      `| ${w.label} | ${w.prsOpened} | ${w.prsMerged} | ${w.commits} | +${num(w.linesAdded)} | -${num(w.linesRemoved)} |`
    );
  }
  lines.push(``);

  // Contributors
  if (result.contributors.length > 0) {
    lines.push(`## Contributors`);
    lines.push(``);
    lines.push(`| Author | PRs Opened | PRs Merged | Commits | +Lines | -Lines | Avg Merge Time |`);
    lines.push(`|--------|-----------|-----------|---------|--------|--------|----------------|`);
    for (const c of result.contributors) {
      lines.push(
        `| ${c.login} | ${c.prsOpened} | ${c.prsMerged} | ${c.commits} | +${num(c.linesAdded)} | -${num(c.linesRemoved)} | ${c.avgMergeTimeHours > 0 ? fmtHours(c.avgMergeTimeHours) : "—"} |`
      );
    }
    lines.push(``);
  }

  // AI amplification insights section
  lines.push(`## AI Amplification Analysis`);
  lines.push(``);
  lines.push(`> This section is intended for AI analysis. Paste this report into Claude or ChatGPT and ask:`);
  lines.push(`> - "Does the weekly trend show accelerating output over time?"`);
  lines.push(`> - "Which contributors show the biggest productivity gains?"`);
  lines.push(`> - "Are code review cycles getting faster or slower?"`);
  lines.push(`> - "What patterns suggest AI tooling is amplifying developer output?"`);
  lines.push(``);

  // Trend analysis data
  const weeks = result.weeklyTrend;
  const mid = Math.floor(weeks.length / 2);
  const firstHalf = weeks.slice(0, mid);
  const secondHalf = weeks.slice(mid);

  const avgPRs = (half: WeeklyBucket[]) =>
    half.length === 0 ? 0 : half.reduce((s, w) => s + w.prsOpened, 0) / half.length;
  const avgCommits = (half: WeeklyBucket[]) =>
    half.length === 0 ? 0 : half.reduce((s, w) => s + w.commits, 0) / half.length;
  const avgLines = (half: WeeklyBucket[]) =>
    half.length === 0 ? 0 : half.reduce((s, w) => s + w.linesAdded, 0) / half.length;

  lines.push(`### Period Comparison (First Half vs Second Half)`);
  lines.push(``);
  lines.push(`| Metric | First Half Avg/week | Second Half Avg/week | Change |`);
  lines.push(`|--------|--------------------|--------------------|--------|`);

  const prChange = avgPRs(firstHalf) > 0
    ? (((avgPRs(secondHalf) - avgPRs(firstHalf)) / avgPRs(firstHalf)) * 100).toFixed(1) + "%"
    : "N/A";
  const commitChange = avgCommits(firstHalf) > 0
    ? (((avgCommits(secondHalf) - avgCommits(firstHalf)) / avgCommits(firstHalf)) * 100).toFixed(1) + "%"
    : "N/A";
  const lineChange = avgLines(firstHalf) > 0
    ? (((avgLines(secondHalf) - avgLines(firstHalf)) / avgLines(firstHalf)) * 100).toFixed(1) + "%"
    : "N/A";

  lines.push(`| PRs/week | ${avgPRs(firstHalf).toFixed(1)} | ${avgPRs(secondHalf).toFixed(1)} | ${prChange} |`);
  lines.push(`| Commits/week | ${avgCommits(firstHalf).toFixed(1)} | ${avgCommits(secondHalf).toFixed(1)} | ${commitChange} |`);
  lines.push(`| Lines added/week | ${avgLines(firstHalf).toFixed(0)} | ${avgLines(secondHalf).toFixed(0)} | ${lineChange} |`);
  lines.push(``);

  lines.push(`---`);
  lines.push(`*Generated by [GitHub IQ](https://github.com/anomalyco/opentui)*`);
  lines.push(``);

  return lines.join("\n");
}

export function saveReport(result: AnalysisResult): string {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const file = join(REPORTS_DIR, `${result.org}-${dateStr}.md`);
  writeFileSync(file, generateMarkdownReport(result), "utf-8");
  return file;
}
