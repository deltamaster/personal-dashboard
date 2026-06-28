#!/usr/bin/env node
/**
 * Static export cannot coexist with app/api routes in one Next.js build.
 * Stash API routes, build, restore.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");
const stashDir = path.join(root, ".api-stash");

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(stashDir)) fs.rmSync(stashDir, { recursive: true });
    fs.renameSync(apiDir, stashDir);
    console.log("Stashed app/api for static export build");
  }

  run("npx", ["cross-env", "BUILD_TARGET=static", "next", "build"]);
} finally {
  if (fs.existsSync(stashDir)) {
    if (fs.existsSync(apiDir)) fs.rmSync(apiDir, { recursive: true });
    fs.renameSync(stashDir, apiDir);
    console.log("Restored app/api");
  }
}
