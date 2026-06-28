#!/usr/bin/env node
/**
 * Package Next.js standalone API build as an FC custom-runtime zip.
 * Layout matches the former Docker image: standalone + static + public + bootstrap.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next/standalone");
const outZip = path.resolve(process.argv[2] || path.join(root, "api.zip"));
const stage = path.join(root, ".fc-stage");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run npm run build:api first.");
  process.exit(1);
}

fs.rmSync(stage, { recursive: true, force: true });
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

fs.copyFileSync(path.join(root, "fc/bootstrap"), path.join(stage, "bootstrap"));
if (process.platform !== "win32") {
  fs.chmodSync(path.join(stage, "bootstrap"), 0o755);
}

fs.rmSync(outZip, { force: true });
run("zip", ["-qr", outZip, "."], { cwd: stage, shell: false });
fs.rmSync(stage, { recursive: true, force: true });

const sizeMb = (fs.statSync(outZip).size / (1024 * 1024)).toFixed(1);
console.log(`Packaged ${outZip} (${sizeMb} MB)`);
