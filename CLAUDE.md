# GitAmplify — Claude Instructions

## Stack
- **Runtime:** Bun (always use `bun` not `npm`/`node`)
- **Language:** TypeScript (strict, ESM modules)
- **GitHub API:** `@octokit/rest` with `@octokit/plugin-throttling`
- **CLI UI:** `@clack/prompts` (prompts), `ora` (spinners), `chalk` (colors), `gradient-string` (gradients), `figlet` (ASCII art), `boxen` (boxes), `cli-table3` (tables)

## Project Structure
```
index.ts              ← Main entry point — prompts, orchestration, cache/report wiring
src/
  types.ts            ← All shared TypeScript interfaces
  github.ts           ← GitHub API calls (repos, PRs, commits, reviews)
  metrics.ts          ← Metric computation (weekly buckets, contributors, review stats)
  display.ts          ← Terminal UI rendering (tables, sparklines, boxes, banner)
  cache.ts            ← JSON cache read/write (.cache/ directory, 24h TTL)
  report.ts           ← Markdown report generation (reports/ directory)
scripts/
  gen-preview.ts      ← Generates preview.svg via svg-term-cli + asciinema cast
```

## Commands
```bash
bun run start         # Run the analyzer
bun run preview       # Regenerate preview.svg
bunx tsc --noEmit     # Type check
```

## Key Conventions
- **Lines added/removed** come from per-commit stats (`repos.getCommit`), NOT from PR stats — avoids double counting
- **Rate limiting** — on limit hit, print resume time and exit (no retrying/waiting)
- **Cache** — raw API data saved to `.cache/{org}-{days}d.json`, loaded on next run to skip API calls entirely
- **Credentials** — `GITHUB_TOKEN` and `GITHUB_ORG` auto-saved to `.env` on first entry; Bun auto-loads `.env`
- **Single active spinner** — always track `activeSpinner` and stop it before printing anything (avoids ora concurrent spinner warnings)
- **No right-border boxes** — box-drawing characters with right borders break due to ANSI escape code length miscounts; use left-border-only style

## Sensitive Files (never commit)
- `.env` — token + org
- `.cache/` — raw API data with private org info
- `reports/` — generated markdown reports

## Color Palette
```
GREEN   #4ADE80   success, lines added, positive trends
RED     #F87171   lines removed, errors
CYAN    #67E8F9   commit counts, secondary info
PURPLE  #818CF8   accent, labels
MUTED   #6B7280   secondary text, borders
WARN    #FBBF24   warnings, partial data
```

## Banner Gradient
cyan `#6EE7F7` → purple `#A78BFA` → pink `#F472B6`
