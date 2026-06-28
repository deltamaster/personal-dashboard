#!/usr/bin/env node
/**
 * API standalone build cannot prerender UI pages that use client providers.
 * Stash UI routes, build, restore.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stashRoot = path.join(root, ".ui-stash");
const pagesDir = path.join(root, "pages");

const uiPaths = [
  path.join("app", "page.tsx"),
  path.join("app", "movies"),
  path.join("app", "portfolio"),
  path.join("app", "travel"),
  path.join("app", "auth"),
];

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function movePath(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true });
}

function stashUi() {
  fs.mkdirSync(stashRoot, { recursive: true });
  for (const rel of uiPaths) {
    movePath(path.join(root, rel), path.join(stashRoot, rel));
  }
}

function restoreUi() {
  if (!fs.existsSync(stashRoot)) return;
  for (const rel of uiPaths) {
    const src = path.join(stashRoot, rel);
    const dest = path.join(root, rel);
    movePath(src, dest);
  }
  fs.rmSync(stashRoot, { recursive: true, force: true });
}

function writeMinimalPagesRouter() {
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.writeFileSync(
    path.join(pagesDir, "_app.tsx"),
    `import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`
  );
  fs.writeFileSync(
    path.join(pagesDir, "_error.tsx"),
    `function ErrorPage({ statusCode }: { statusCode: number }) {
  return <p>{statusCode}</p>;
}

ErrorPage.getInitialProps = ({
  res,
  err,
}: {
  res?: { statusCode?: number };
  err?: { statusCode?: number };
}) => ({
  statusCode: res?.statusCode ?? err?.statusCode ?? 404,
});

export default ErrorPage;
`
  );
}

function removeMinimalPagesRouter() {
  if (fs.existsSync(pagesDir)) {
    fs.rmSync(pagesDir, { recursive: true, force: true });
  }
}

try {
  stashUi();
  writeMinimalPagesRouter();
  console.log("Stashed UI pages for API build");
  run("npx", ["cross-env", "BUILD_TARGET=api", "next", "build"]);
} finally {
  restoreUi();
  removeMinimalPagesRouter();
  console.log("Restored UI pages");
}
