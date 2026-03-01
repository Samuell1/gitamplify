/**
 * Generates preview.svg using svg-term-cli + a fake asciinema cast.
 * Run with: bun run preview
 */
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const RESET = "\x1b[0m";

// Interpolate between two RGB colors
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

// Multi-stop gradient across a string
function gradientText(text: string): string {
  const stops: [number, number, number][] = [
    [110, 231, 247], // #6EE7F7 cyan
    [167, 139, 250], // #A78BFA purple
    [244, 114, 182], // #F472B6 pink
  ];
  const chars = text.split("");
  return (
    chars
      .map((ch, i) => {
        const t = chars.length <= 1 ? 0 : i / (chars.length - 1);
        const seg = t * (stops.length - 1);
        const idx = Math.min(Math.floor(seg), stops.length - 2);
        const local = seg - idx;
        const [r1, g1, b1] = stops[idx];
        const [r2, g2, b2] = stops[idx + 1];
        const r = lerp(r1, r2, local);
        const g = lerp(g1, g2, local);
        const b = lerp(b1, b2, local);
        return `\x1b[38;2;${r};${g};${b}m${ch}`;
      })
      .join("") + RESET
  );
}

function fg(r: number, g: number, b: number, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

const muted   = (s: string) => fg(110, 118, 129, s);
const green   = (s: string) => fg(63,  185,  80, s);
const purple  = (s: string) => fg(188, 140, 255, s);
const cyan    = (s: string) => fg(57,  197, 207, s);
const pink    = (s: string) => fg(244, 114, 182, s);
const white   = (s: string) => `\x1b[1;37m${s}${RESET}`;
const red     = (s: string) => fg(255, 123, 114, s);
const indigo  = (s: string) => fg(129, 140, 248, s);

const bannerLines = [
  "   _____ _ _                            _ _  __       ",
  "  / ____(_) |     /\\                   | (_)/ _|      ",
  " | |  __ _| |_   /  \\   _ __ ___  _ __ | |_| |_ _   _",
  " | | |_ | | __| / /\\ \\ | '_ ` _ \\| '_ \\| | |  _| | | |",
  " | |__| | | |_ / ____ \\| | | | | | |_) | | | | | |_| |",
  "  \\_____|_|\\__/_/    \\_\\_| |_| |_| .__/|_|_|_|  \\__, |",
  "                                 | |             __/ | ",
  "                                 |_|            |___/  ",
];

const outputLines: string[] = [
  "",
  ...bannerLines.map(gradientText),
  muted("  GitHub Org Productivity Analyzer \u2014 AI Amplification Metrics"),
  "",
  purple("\u250c  GitAmplify \u2014 AI Amplification Analyzer"),
  muted("\u2502"),
  green("\u2714 ") + green("Using saved token"),
  green("\u2714 ") + green("Using saved org: ") + white("acme-corp"),
  muted("\u2502"),
  cyan("\u25c6  ") + "Date range to analyze",
  muted("\u2502  ") + white("Last 90 days"),
  muted("\u2502"),
  green("\u2714 ") + green("Connected to org: ") + white("acme-corp"),
  green("\u2714 ") + green("Found ") + white("8") + green(" repos to scan"),
  green("\u2714 ") + muted("[1/8] ") + white("frontend") + green(" \u2014 24 PRs"),
  green("\u2714 ") + muted("[1/8] ") + white("frontend") + green(" \u2014 87 commits"),
  green("\u2714 ") + muted("[2/8] ") + white("backend-api") + green(" \u2014 18 PRs"),
  green("\u2714 ") + muted("[2/8] ") + white("backend-api") + green(" \u2014 103 commits"),
  muted("  \u00b7\u00b7\u00b7 6 more repos"),
  green("\u2714 ") + green("Analysis complete"),
  "",
  purple("\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 SUMMARY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"),
  purple("\u2502") + "  " + indigo("Organization  ") + white("acme-corp"),
  purple("\u2502") + "  " + indigo("Repos  ") + white("8") + "  " + muted("\u00b7") + "  " + indigo("Range  ") + white("Dec 2, 2025 \u2192 Mar 1, 2026"),
  purple("\u2502"),
  purple("\u2502") + "  " + green("\u25b8 PRs opened     ") + white("142"),
  purple("\u2502") + "  " + green("\u25b8 PRs merged     ") + white("128  ") + muted("(90.1% merge rate)"),
  purple("\u2502") + "  " + green("\u25b8 Total commits  ") + white("1,204"),
  purple("\u2502") + "  " + green("\u25b8 Lines added    ") + green("+48,302"),
  purple("\u2502") + "  " + red("\u25b8 Lines removed  ") + red("-12,841"),
  purple("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"),
  "",
  "  " + muted("PR trend    ") + fg(210, 163, 68, "\u2581\u2582\u2583\u2584") + green("\u2585\u2586\u2587\u2588\u2587\u2586\u2585") + "  " + muted("(max: 22)"),
  "  " + muted("Commit trend ") + fg(210, 163, 68, "\u2581\u2581\u2582\u2583\u2584\u2585") + green("\u2586\u2587\u2588\u2588\u2587\u2586") + "  " + muted("(max: 134)"),
  "",
  pink("\u250c\u2500\u2500\u2500\u2500 AI AMPLIFICATION INSIGHTS \u2500\u2500\u2500\u2500"),
  pink("\u2502") + "  " + green("\u2191 ") + "PR volume grew " + green("34.2%") + " in second half \u2014 " + green("strong momentum"),
  pink("\u2502") + "  " + green("\u2191 ") + "Commit frequency up " + green("28.7%") + " \u2014 devs shipping more often",
  pink("\u2502") + "  " + green("\u26a1 ") + "Avg merge time under 24h \u2014 fast review cycle",
  pink("\u2502") + "  " + green("\u2713 ") + "90% merge rate \u2014 very healthy PR flow",
  pink("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"),
  "",
  green("\u2714 ") + green("Report saved \u2192 ") + white("reports/acme-corp-2026-03-01.md"),
  purple("\u2514  Done!"),
  "",
];

// Build asciinema v2 cast
const WIDTH = 72;
const HEIGHT = outputLines.length + 2;
const header = JSON.stringify({ version: 2, width: WIDTH, height: HEIGHT, title: "GitAmplify" });
const events = outputLines.map((line, i) =>
  JSON.stringify([i * 0.35, "o", line + "\r\n"])
);
const cast = [header, ...events].join("\n");

const castFile = join(import.meta.dir, "..", ".cache", "preview.cast");
const outFile  = join(import.meta.dir, "..", "preview.svg");

// Ensure .cache dir exists
import { mkdirSync } from "fs";
mkdirSync(join(import.meta.dir, "..", ".cache"), { recursive: true });

writeFileSync(castFile, cast, "utf-8");

try {
  execSync(
    `bunx svg-term-cli --in "${castFile}" --out "${outFile}" --window --no-cursor --width ${WIDTH} --height ${HEIGHT}`,
    { stdio: "inherit" }
  );
  console.log(`✓ preview.svg saved`);
} finally {
  if (existsSync(castFile)) unlinkSync(castFile);
}
