export interface RepoSummary {
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  pushedAt: string | null;
}

export interface PRData {
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  user: string;
  repoName: string;
  firstReviewAt: string | null;
  reviewCount: number;
}

export interface CommitData {
  sha: string;
  date: string;
  author: string;
  message: string;
  repoName: string;
  additions: number;
  deletions: number;
}

export interface WeeklyBucket {
  week: string; // "YYYY-WW"
  label: string; // "Mar 3 – Mar 9"
  prsOpened: number;
  prsMerged: number;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface ContributorStats {
  login: string;
  prsOpened: number;
  prsMerged: number;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  avgMergeTimeHours: number;
}

export interface ReviewStats {
  avgTimeToFirstReviewHours: number;
  avgTimeToMergeHours: number;
  fastestMergeHours: number;
  slowestMergeHours: number;
  prsWithReview: number;
  prsWithoutReview: number;
}

export interface AnalysisResult {
  org: string;
  repoCount: number;
  dateRange: { from: string; to: string };
  weeklyTrend: WeeklyBucket[];
  contributors: ContributorStats[];
  reviewStats: ReviewStats;
  totalPRsOpened: number;
  totalPRsMerged: number;
  totalCommits: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
}
