import { format, getISOWeek, getYear, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";
import type {
  PRData,
  CommitData,
  WeeklyBucket,
  ContributorStats,
  ReviewStats,
  AnalysisResult,
  RepoSummary,
} from "./types.ts";

function weekKey(date: Date): string {
  return `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

function weekLabel(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000 / 3600;
}

export function computeMetrics(
  org: string,
  repos: RepoSummary[],
  allPRs: PRData[],
  allCommits: CommitData[],
  since: Date,
  until: Date
): AnalysisResult {
  // --- Weekly buckets ---
  const weeks = eachWeekOfInterval(
    { start: since, end: until },
    { weekStartsOn: 1 }
  );

  const bucketMap = new Map<string, WeeklyBucket>();
  for (const w of weeks) {
    const key = weekKey(w);
    bucketMap.set(key, {
      week: key,
      label: weekLabel(w),
      prsOpened: 0,
      prsMerged: 0,
      commits: 0,
      linesAdded: 0,
      linesRemoved: 0,
    });
  }

  for (const pr of allPRs) {
    const key = weekKey(new Date(pr.createdAt));
    const b = bucketMap.get(key);
    if (b) b.prsOpened++;
    if (pr.mergedAt) {
      const mk = weekKey(new Date(pr.mergedAt));
      const mb = bucketMap.get(mk);
      if (mb) mb.prsMerged++;
    }
  }

  for (const c of allCommits) {
    if (!c.date) continue;
    const key = weekKey(new Date(c.date));
    const b = bucketMap.get(key);
    if (b) {
      b.commits++;
      b.linesAdded += c.additions;
      b.linesRemoved += c.deletions;
    }
  }

  const weeklyTrend = Array.from(bucketMap.values());

  // --- Contributor stats ---
  const contribMap = new Map<string, ContributorStats>();

  const getContrib = (login: string) => {
    if (!contribMap.has(login)) {
      contribMap.set(login, {
        login,
        prsOpened: 0,
        prsMerged: 0,
        commits: 0,
        linesAdded: 0,
        linesRemoved: 0,
        avgMergeTimeHours: 0,
      });
    }
    return contribMap.get(login)!;
  };

  const mergeTimesPerContrib = new Map<string, number[]>();

  for (const pr of allPRs) {
    const c = getContrib(pr.user);
    c.prsOpened++;
    if (pr.mergedAt) {
      c.prsMerged++;
      const hours = hoursBetween(pr.createdAt, pr.mergedAt);
      if (!mergeTimesPerContrib.has(pr.user))
        mergeTimesPerContrib.set(pr.user, []);
      mergeTimesPerContrib.get(pr.user)!.push(hours);
    }
  }

  for (const c of allCommits) {
    const contrib = getContrib(c.author);
    contrib.commits++;
    contrib.linesAdded += c.additions;
    contrib.linesRemoved += c.deletions;
  }

  for (const [login, times] of mergeTimesPerContrib) {
    const c = contribMap.get(login);
    if (c && times.length > 0) {
      c.avgMergeTimeHours = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  const contributors = Array.from(contribMap.values()).sort(
    (a, b) => b.prsOpened + b.commits - (a.prsOpened + a.commits)
  );

  // --- Review stats ---
  const mergedPRs = allPRs.filter((p) => p.mergedAt);
  const timeToFirstReview: number[] = [];
  const timeToMerge: number[] = [];

  for (const pr of mergedPRs) {
    const mergeHours = hoursBetween(pr.createdAt, pr.mergedAt!);
    timeToMerge.push(mergeHours);

    if (pr.firstReviewAt) {
      timeToFirstReview.push(hoursBetween(pr.createdAt, pr.firstReviewAt));
    }
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  const reviewStats: ReviewStats = {
    avgTimeToFirstReviewHours: avg(timeToFirstReview),
    avgTimeToMergeHours: avg(timeToMerge),
    fastestMergeHours: timeToMerge.length ? Math.min(...timeToMerge) : 0,
    slowestMergeHours: timeToMerge.length ? Math.max(...timeToMerge) : 0,
    prsWithReview: allPRs.filter((p) => p.reviewCount > 0).length,
    prsWithoutReview: allPRs.filter((p) => p.reviewCount === 0).length,
  };

  return {
    org,
    repoCount: repos.length,
    dateRange: {
      from: format(since, "MMM d, yyyy"),
      to: format(until, "MMM d, yyyy"),
    },
    weeklyTrend,
    contributors,
    reviewStats,
    totalPRsOpened: allPRs.length,
    totalPRsMerged: mergedPRs.length,
    totalCommits: allCommits.length,
    totalLinesAdded: allCommits.reduce((s, c) => s + c.additions, 0),
    totalLinesRemoved: allCommits.reduce((s, c) => s + c.deletions, 0),
  };
}
