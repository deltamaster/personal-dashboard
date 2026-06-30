#!/usr/bin/env node
/**
 * Package Next.js standalone API build as an FC custom-runtime zip.
 * Bundles the Linux x64 Node.js binary (same major as .nvmrc / build env) so FC
 * runs Node 22 — Alibaba custom.debian10 only ships built-in Node 18/20.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next/standalone");
const outZip = path.resolve(process.argv[2] || path.join(root, "api.zip"));
const stage = path.join(root, ".fc-stage");
const nodeCacheDir = path.join(root, ".fc-node-cache");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readTargetNodeVersion() {
  if (process.env.FC_NODE_VERSION?.trim()) {
    const v = process.env.FC_NODE_VERSION.trim();
    return v.startsWith("v") ? v : `v${v}`;
  }
  const nvmrc = path.join(root, ".nvmrc");
  if (fs.existsSync(nvmrc)) {
    const major = fs.readFileSync(nvmrc, "utf8").trim();
    if (major) {
      const buildMajor = process.version.match(/^v(\d+)/)?.[1];
      if (buildMajor === major) return process.version;
    }
  }
  return process.version;
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url} (HTTP ${res.status})`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function bundleLinuxNode(stageDir) {
  const version = readTargetNodeVersion();
  const tarball = `node-${version}-linux-x64.tar.xz`;
  const url = `https://nodejs.org/dist/${version}/${tarball}`;
  fs.mkdirSync(nodeCacheDir, { recursive: true });
  const cachePath = path.join(nodeCacheDir, tarball);

  if (!fs.existsSync(cachePath)) {
    console.log(`Downloading ${url} for FC bundle…`);
    await downloadFile(url, cachePath);
  } else {
    console.log(`Using cached ${tarball} for FC bundle`);
  }

  run("tar", ["-xJf", cachePath, "-C", stageDir]);
  const extracted = path.join(stageDir, `node-${version}-linux-x64`);
  fs.renameSync(extracted, path.join(stageDir, "node"));
  console.log(`Bundled Node ${version} (linux-x64) → node/bin/node`);
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run npm run build:api first.");
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(standalone, stage, { recursive: true });

const staticDir = path.join(root, ".next/static");
if (fs.existsSync(staticDir)) {
  fs.mkdirSync(path.join(stage, ".next"), { recursive: true });
  fs.cpSync(staticDir, path.join(stage, ".next/static"), { recursive: true });
}

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(stage, "public"), { recursive: true });
}

await bundleLinuxNode(stage);

fs.copyFileSync(path.join(root, "fc/bootstrap"), path.join(stage, "bootstrap"));
if (process.platform !== "win32") {
  fs.chmodSync(path.join(stage, "bootstrap"), 0o755);
  fs.chmodSync(path.join(stage, "node/bin/node"), 0o755);
}

fs.rmSync(outZip, { force: true });
run("zip", ["-qr", outZip, "."], { cwd: stage, shell: false });
fs.rmSync(stage, { recursive: true, force: true });

const sizeMb = (fs.statSync(outZip).size / (1024 * 1024)).toFixed(1);
console.log(`Packaged ${outZip} (${sizeMb} MB)`);
