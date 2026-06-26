#!/usr/bin/env node
/**
 * Merge MCP registry entries from:
 * - modelcontextprotocol/servers (main — wins on duplicate folder names)
 * - modelcontextprotocol/servers-archived
 * - punkpeye/awesome-mcp-servers README (lines with GitHub link + `npx ...`)
 * - registry.overrides.json (deep-merge wins; can add entries not in upstream)
 *
 * Probes microsoft/mcp — skipped (NuGet/stdot, not npm npx).
 */

import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(ROOT, "index.json");
const OVERRIDES_FILE = join(ROOT, "registry.overrides.json");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const PRINT_JSON = args.has("--print-json");

const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const stats = {
  officialMainDirs: 0,
  officialArchivedDirs: 0,
  officialSkippedDup: 0,
  officialPackageFailures: 0,
  awesomeLinesConsidered: 0,
  awesomeRowsParsed: 0,
  microsoftMcp: "skipped (NuGet / non-npm packages)",
  mergedBeforeOverrides: 0,
  overrideKeys: 0,
  needsReview: 0,
  droppedEmptyInstall: 0,
};

function headers() {
  const h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function githubFetchJson(path) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

function deepMerge(base, patch) {
  if (patch === undefined || patch === null) return base;
  if (Array.isArray(patch)) return patch.slice();
  if (typeof patch !== "object" || patch === null) return patch;
  const out = { ...(base && typeof base === "object" ? base : {}) };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (pv !== null && typeof pv === "object" && !Array.isArray(pv) && bv !== null && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

function guessAuthType(text) {
  const t = (text || "").toUpperCase();
  if (
    /\b(API_KEY|API_TOKEN|ACCESS_KEY|SECRET_KEY|ACCESS_TOKEN|AUTH_TOKEN|PERSONAL_ACCESS|BEARER|OAUTH|PASSWORD|CREDENTIAL)\b/.test(t) ||
    /\bENV\b.*\bVAR/.test(t)
  ) {
    return "env";
  }
  return "none";
}

function normalizeNpx(cmd) {
  const s = cmd.trim().replace(/\s+/g, " ");
  const parts = s.split(" ");
  if (parts[0] === "npx" && parts[1] !== "-y" && parts[1] !== "--yes") {
    return `npx -y ${parts.slice(1).join(" ")}`.trim();
  }
  return s;
}

function extractNpxFromLine(line) {
  const backticks = [...line.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
  for (const chunk of backticks) {
    if (/\bnpx\b/.test(chunk)) return normalizeNpx(chunk);
    if (/\bnpm\s+exec\b/.test(chunk)) return normalizeNpx(chunk.replace(/npm\s+exec\s*-c\s*/, "npx -y ").trim());
  }
  return "";
}

function stripAwesomeDescription(line) {
  let rest = line.replace(/^-\s*/, "");
  rest = rest.replace(/^\[[^\]]+\]\([^)]+\)\s*/, "");
  rest = rest.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ");
  rest = rest.replace(/\[[^\]]+\]\([^)]+\)/g, " ");
  rest = rest.replace(/`[^`]*`/g, " ");
  rest = rest.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\uFE0F]/gu, " ");
  rest = rest.replace(/\s+/g, " ").trim();
  rest = rest.replace(/^[-–—.:]+\s*/, "").trim();
  rest = rest.replace(/\s+\.\s*$/, "").trim();
  return rest.slice(0, 500);
}

function parseAwesomeReadme(md) {
  const lines = md.split("\n");
  const out = [];
  const linkRe = /\[(?<title>[^\]]+)\]\((?<url>https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/)#?]+)[^)]*)\)/;

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("-") || !t.includes("github.com")) continue;
    stats.awesomeLinesConsidered++;
    const m = line.match(linkRe);
    if (!m) continue;
    const installUrl = extractNpxFromLine(line);
    if (!installUrl || !installUrl.startsWith("npx ")) continue;

    const { title, owner, repo } = m.groups;
    const id = `${owner}-${repo}`.toLowerCase();
    const url = `https://github.com/${owner}/${repo}`;
      const description =
        stripAwesomeDescription(line) || `${title.replace(/\s+/g, " ").trim()} (community MCP)`;

    out.push({
      id,
      name: title.replace(/\s+/g, " ").trim(),
      description,
      source: url,
      installUrl,
      authType: guessAuthType(description),
      envVars: [],
      tags: ["community"],
      needsReview: true,
      verified: false,
    });
  }
  stats.awesomeRowsParsed = out.length;
  return out;
}

async function listSrcDirs(owner, repo) {
  const data = await githubFetchJson(`/repos/${owner}/${repo}/contents/src?ref=main`);
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x.type === "dir").map((x) => x.name);
}

async function loadPackageJson(owner, repo, dir) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/src/${dir}/package.json`;
  try {
    const raw = await fetchText(url);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function titleFromPackageName(name) {
  if (!name || typeof name !== "string") return "MCP server";
  const strip = name.replace(/^@[^/]+\//, "").replace(/-/g, " ");
  return strip.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildOfficialEntry(owner, repo, dir, pkg, archived) {
  if (!pkg?.name) return null;
  const npmlink = pkg.name.startsWith("@") ? pkg.name : pkg.name;
  const installUrl = `npx -y ${npmlink}`;
  const description = (pkg.description || "").trim() || titleFromPackageName(pkg.name);
  const source = `https://github.com/${owner}/${repo}/tree/main/src/${dir}`;
  const t = `${description} ${JSON.stringify(pkg)}`;
  return {
    id: dir,
    name: titleFromPackageName(pkg.name),
    description,
    source,
    installUrl,
    authType: guessAuthType(t),
    envVars: [],
    tags: Array.isArray(pkg.keywords) ? pkg.keywords.slice(0, 8) : undefined,
    tier: "free",
    verified: true,
    needsReview: false,
    _from: archived ? "servers-archived" : "servers-main",
  };
}

async function collectOfficial() {
  const map = new Map();
  const mainDirs = await listSrcDirs("modelcontextprotocol", "servers");
  stats.officialMainDirs = mainDirs.length;

  for (const dir of mainDirs) {
    const pkg = await loadPackageJson("modelcontextprotocol", "servers", dir);
    if (!pkg) {
      stats.officialPackageFailures++;
      continue;
    }
    const entry = buildOfficialEntry("modelcontextprotocol", "servers", dir, pkg, false);
    if (entry) map.set(dir, entry);
  }

  const archDirs = await listSrcDirs("modelcontextprotocol", "servers-archived");
  stats.officialArchivedDirs = archDirs.length;

  for (const dir of archDirs) {
    if (map.has(dir)) {
      stats.officialSkippedDup++;
      continue;
    }
    const pkg = await loadPackageJson("modelcontextprotocol", "servers-archived", dir);
    if (!pkg) {
      stats.officialPackageFailures++;
      continue;
    }
    const entry = buildOfficialEntry("modelcontextprotocol", "servers-archived", dir, pkg, true);
    if (entry) map.set(dir, entry);
  }

  return map;
}

function mergeAwesome(officialMap, awesomeList) {
  const m = new Map(officialMap);
  const officialInstall = new Set([...officialMap.values()].map((e) => e.installUrl));

  for (const row of awesomeList) {
    if (m.has(row.id)) continue;
    const byInstall = [...m.values()].find((e) => e.installUrl === row.installUrl);
    if (byInstall) continue;
    if (officialInstall.has(row.installUrl)) continue;
    m.set(row.id, { ...row, _from: "awesome" });
  }
  return m;
}

function stripInternal(entry) {
  const { _from, ...rest } = entry;
  return rest;
}

async function loadOverrides() {
  try {
    const raw = await readFile(OVERRIDES_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { mcps: {} };
  }
}

function applyOverrides(map, doc) {
  const mcps = doc.mcps || {};
  const ids = typeof mcps === "object" && !Array.isArray(mcps) ? Object.keys(mcps) : [];
  stats.overrideKeys = ids.length;

  for (const id of ids) {
    const patch = mcps[id];
    const cur = map.get(id) || { id };
    const merged = deepMerge(cur, patch);
    if (!merged.id) merged.id = id;
    map.set(id, merged);
  }
}

function finalizeEntry(e) {
  const o = stripInternal(e);
  // "oauth" is a valid hand-curated auth type (HTTP MCPs); only coerce truly
  // unknown values. Auto-discovered upstream entries are still env/none.
  if (o.authType !== "env" && o.authType !== "none" && o.authType !== "oauth") {
    o.authType = "none";
  }
  if (!Array.isArray(o.envVars)) o.envVars = [];
  if (o.needsReview) stats.needsReview++;
  return o;
}

async function probeMicrosoftMcp() {
  try {
    await githubFetchJson("/repos/microsoft/mcp/contents/servers?ref=main");
  } catch {
    stats.microsoftMcp = "unreachable";
  }
}

async function main() {
  console.log("atlarix-mcps sync: fetching upstream…");
  await probeMicrosoftMcp();

  const official = await collectOfficial();
  const awesomeMd = await fetchText(
    "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md",
  );
  const awesome = parseAwesomeReadme(awesomeMd);

  let merged = mergeAwesome(official, awesome);
  stats.mergedBeforeOverrides = merged.size;

  const overrides = await loadOverrides();
  applyOverrides(merged, overrides);

  let mcps = [...merged.values()].map(finalizeEntry).filter((e) => {
    // OAuth (remote HTTP) MCPs are launched from `url`, not `installUrl`.
    if (e.authType === "oauth") {
      if (!e.url || !String(e.url).trim()) {
        stats.droppedEmptyInstall++;
        console.warn(`dropping ${e.id}: oauth entry missing url`);
        return false;
      }
      return true;
    }
    if (!e.installUrl || !String(e.installUrl).trim()) {
      stats.droppedEmptyInstall++;
      console.warn(`dropping ${e.id}: empty installUrl`);
      return false;
    }
    return true;
  });

  mcps.sort((a, b) => a.id.localeCompare(b.id));

  const index = {
    version: "1",
    updatedAt: new Date().toISOString().slice(0, 10),
    mcps,
  };

  console.log("\n--- sync summary ---");
  console.log(`modelcontextprotocol/servers src dirs: ${stats.officialMainDirs}`);
  console.log(`modelcontextprotocol/servers-archived src dirs: ${stats.officialArchivedDirs}`);
  console.log(`official skipped (same folder in main): ${stats.officialSkippedDup}`);
  console.log(`official package.json failures: ${stats.officialPackageFailures}`);
  console.log(`awesome README lines w/ github link: ${stats.awesomeLinesConsidered}`);
  console.log(`awesome rows with npx install hint: ${stats.awesomeRowsParsed}`);
  console.log(`microsoft/mcp: ${stats.microsoftMcp}`);
  console.log(`unique entries before overrides: ${stats.mergedBeforeOverrides}`);
  console.log(`override keys applied: ${stats.overrideKeys}`);
  console.log(`final mcps: ${mcps.length}`);
  console.log(`flagged needsReview: ${stats.needsReview}`);
  console.log(`dropped (empty install): ${stats.droppedEmptyInstall}`);
  console.log("--------------------\n");

  if (PRINT_JSON) console.log(JSON.stringify(index, null, 2));

  if (DRY_RUN) {
    console.log("[dry-run] not writing index.json");
    return;
  }

  await writeFile(OUT_FILE, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
