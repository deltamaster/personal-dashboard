/**
 * Fit lng/lat → @svg-maps/china viewBox in one global affine (no per-point overrides).
 * x = ax·lng + bx·lat + cx,  y = dx·lng + ex·lat + fx
 *
 * Usage: node scripts/fit-map-align.mjs
 */
import chinaMap from "@svg-maps/china";
import { TAIWAN_GROUP_TRANSFORM, TAIWAN_PATH } from "../lib/china-map-extras.ts";

function pathNums(tok) {
  return (tok.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
}

function pathPoints(d) {
  const pts = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const tok of d.match(/[a-zA-Z][^a-zA-Z]*/g) || []) {
    const cmd = tok[0];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const nums = pathNums(tok);
    if (C === "M") {
      for (let i = 0; i < nums.length; i += 2) {
        if (i === 0 && !rel) {
          x = nums[i];
          y = nums[i + 1];
        } else {
          x += nums[i];
          y += nums[i + 1];
        }
        startX = x;
        startY = y;
        pts.push([x, y]);
      }
    } else if (C === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        x = rel ? x + nums[i] : nums[i];
        y = rel ? y + nums[i + 1] : nums[i + 1];
        pts.push([x, y]);
      }
    } else if (C === "H") {
      for (const n of nums) {
        x = rel ? x + n : n;
        pts.push([x, y]);
      }
    } else if (C === "V") {
      for (const n of nums) {
        y = rel ? y + n : n;
        pts.push([x, y]);
      }
    } else if (C === "C") {
      for (let i = 0; i < nums.length; i += 6) {
        x = rel ? x + nums[i + 4] : nums[i + 4];
        y = rel ? y + nums[i + 5] : nums[i + 5];
        pts.push([x, y]);
      }
    } else if (C === "Z") {
      x = startX;
      y = startY;
    }
  }
  return pts;
}

function centroid(d) {
  const pts = pathPoints(d);
  if (!pts.length) return null;
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function parseTaiwanTransform() {
  const m = TAIWAN_GROUP_TRANSFORM.match(
    /translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/
  );
  return { tx: +m[1], ty: +m[2], sx: +m[3], sy: +m[4] };
}

function taiwanTarget() {
  const tw = parseTaiwanTransform();
  const pts = pathPoints(TAIWAN_PATH).map(([x, y]) => [
    (x + tw.tx) * tw.sx,
    (y + tw.ty) * tw.sy,
  ]);
  const finite = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const xs = finite.map((p) => p[0]);
  const minX = Math.min(...xs);
  const west = finite.filter((p) => p[0] < minX + 30);
  const y = west.reduce((s, p) => s + p[1], 0) / west.length;
  return [minX + 12, y - 5];
}

function solve3(rows, targetIdx) {
  const ATA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const ATb = [0, 0, 0];
  for (const { ll, map, weight = 1 } of rows) {
    const row = [ll[0], ll[1], 1];
    const target = map[targetIdx];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) ATA[i][j] += weight * row[i] * row[j];
      ATb[i] += weight * row[i] * target;
    }
  }
  const M = ATA.map((r, i) => [...r, ATb[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col];
    for (let j = col; j < 4; j++) M[col][j] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j < 4; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((r) => r[3]);
}

const COORDS = {
  上海: [121.4737, 31.2304],
  北京: [116.4074, 39.9042],
  广州: [113.2644, 23.1291],
  昆明: [102.8329, 24.8801],
  成都: [104.0665, 30.5723],
  西安: [108.9398, 34.3416],
  杭州: [120.1551, 30.2741],
  南京: [118.7969, 32.0603],
  南宁: [108.3669, 22.817],
  厦门: [118.0894, 24.4798],
  武汉: [114.3055, 30.5928],
  台北: [121.5654, 25.033],
  西双版纳: [100.7979, 22.0017],
  北海: [109.1193, 21.4733],
  三亚: [109.5119, 18.2528],
};

/** Manual SVG anchors for cities where province centroids drift (small NW / inland nudge). */
const MANUAL_TARGETS = {
  西双版纳: [338, 503],
  北海: [443, 518],
  三亚: [450, 566],
};

const refs = [
  ["上海", "shanghai", 4],
  ["北京", "beijing", 1],
  ["广州", "guangdong", 1],
  ["昆明", "yunnan", 1],
  ["成都", "sichuan", 1],
  ["西安", "shaanxi", 1],
  ["杭州", "zhejiang", 2],
  ["南京", "jiangsu", 2],
  ["南宁", "guangxi-zhuang", 1],
  ["厦门", "fujian", 1],
  ["武汉", "hubei", 1],
  ["台北", null, 3],
  ["西双版纳", "manual", 2],
  ["北海", "manual", 2],
  ["三亚", "manual", 1],
];

const twTarget = taiwanTarget();
console.log("taiwan target", twTarget.map((v) => v.toFixed(1)));

const rows = [];
for (const [name, id, weight] of refs) {
  const loc = id && id !== "manual" ? chinaMap.locations.find((l) => l.id === id) : null;
  const map =
    id === "manual"
      ? MANUAL_TARGETS[name]
      : id
        ? centroid(loc.path)
        : twTarget;
  rows.push({ name, ll: COORDS[name], map, weight });
}

const PROJECT_X = solve3(rows, 0);
const PROJECT_Y = solve3(rows, 1);

console.log("PROJECT_X =", JSON.stringify(PROJECT_X));
console.log("PROJECT_Y =", JSON.stringify(PROJECT_Y));

function project(ll) {
  return [
    PROJECT_X[0] * ll[0] + PROJECT_X[1] * ll[1] + PROJECT_X[2],
    PROJECT_Y[0] * ll[0] + PROJECT_Y[1] * ll[1] + PROJECT_Y[2],
  ];
}

for (const row of rows) {
  const p = project(row.ll);
  const err = Math.hypot(row.map[0] - p[0], row.map[1] - p[1]);
  console.log(`${row.name}: err ${err.toFixed(1)}px ->`, p.map((v) => v.toFixed(1)));
}

console.log("--- check ---");
for (const name of ["西双版纳", "北海", "三亚", "台北", "上海"]) {
  console.log(name, project(COORDS[name]).map((v) => v.toFixed(1)));
}
