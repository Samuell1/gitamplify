# GitAmplify

> Analyze your GitHub org's productivity and measure AI amplification signals — from the terminal.

![GitAmplify preview](./preview.svg)

Fetches PRs, commits, and code review data across all repos in your org, then renders a rich terminal report with weekly trends, contributor stats, and AI amplification insights.

![Bun](https://img.shields.io/badge/runtime-bun-f472b6?style=flat-square)
![TypeScript](https://img.shields.io/badge/language-typescript-3178c6?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-4ade80?style=flat-square)

## Features

- **PR velocity** — open/merge rate per week across all repos
- **Commit frequency & volume** — commits and lines changed per dev, per week
- **Code review turnaround** — time from PR open → first review → merge
- **AI amplification insights** — auto-compares first vs second half of the period
- **Top contributors** — per-dev breakdown with avg merge time
- **Sparklines** — visual trend bars in the terminal
- **Local cache** — saves raw API data as JSON, skips GitHub API on repeat runs
- **Markdown report** — exports a structured `.md` file you can paste into Claude/ChatGPT for deeper analysis

## Requirements

- [Bun](https://bun.sh) v1.0+
- A GitHub Personal Access Token (PAT)

## Setup

```bash
git clone https://github.com/your-org/gitamplify
cd gitamplify
bun install
```

## GitHub Token

Create a fine-grained PAT at `github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens` with:

- **Resource owner**: your org
- **Repository permissions**: `Contents` (read), `Pull requests` (read), `Metadata` (read)

## Usage

```bash
bun run start
```

On first run you'll be prompted for your token and org — both are saved to `.env` automatically so you won't be asked again.

### Environment variables (optional)

Copy `.env.example` to `.env` to pre-fill values:

```bash
cp .env.example .env
```

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_ORG=my-company
```

## Output

The tool generates two outputs:

| Output | Location | Purpose |
|--------|----------|---------|
| Terminal report | stdout | Rich tables, sparklines, insights |
| Markdown report | `reports/{org}-{date}.md` | Share with team or paste into Claude |
| JSON cache | `.cache/{org}-{days}d.json` | Reuse data without re-fetching |

## Rate Limits

GitHub allows 5,000 API requests/hour per token. For large orgs, the tool will display a message like:

```
⚠ GitHub rate limit hit.
ℹ Run again after 15:32 (36 min from now)
```

Use the cache on repeat runs to avoid hitting limits.

## License

MIT
