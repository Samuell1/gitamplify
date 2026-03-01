import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { RepoSummary, PRData, CommitData } from "./types.ts";

const CACHE_DIR = join(import.meta.dir, "..", ".cache");
const CACHE_TTL_HOURS = 24;

export interface CachePayload {
  cachedAt: string;
  org: string;
  since: string;
  until: string;
  days: number;
  repos: RepoSummary[];
  prs: PRData[];
  commits: CommitData[];
}

function cacheFile(org: string, days: number): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  return join(CACHE_DIR, `${org}-${days}d.json`);
}

export function loadCache(org: string, days: number): CachePayload | null {
  const file = cacheFile(org, days);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, "utf-8");
    const payload: CachePayload = JSON.parse(raw);
    const ageHours =
      (Date.now() - new Date(payload.cachedAt).getTime()) / 1000 / 3600;

    if (ageHours > CACHE_TTL_HOURS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function saveCache(payload: CachePayload): string {
  const file = cacheFile(payload.org, payload.days);
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  return file;
}

export function cacheAge(cachedAt: string): string {
  const mins = Math.round(
    (Date.now() - new Date(cachedAt).getTime()) / 1000 / 60
  );
  if (mins < 60) return `${mins}m ago`;
  return `${(mins / 60).toFixed(1)}h ago`;
}
