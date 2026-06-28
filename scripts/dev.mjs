#!/usr/bin/env node
/**
 * Start Next.js dev on a fixed port using the filesystem's canonical path casing.
 * On Windows, mixed Projects/projects paths duplicate Next modules and break hydration.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = fs.realpathSync.native(process.cwd());
process.chdir(root);

const port = process.env.PORT ?? "3000";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

console.log(`Dev root: ${root}`);

const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
