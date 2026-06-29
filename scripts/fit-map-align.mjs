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

function solve6(rows) {
  const ATA = Array.from({ length: 6 }, () => Array(6).fill(0));
  const ATb = Array(6).fill(0);
  for (const { ll, map, weight = 1 } of rows) {
    const [lng, lat] = ll;
    const [tx, ty] = map;
    const rx = [lng, lat, 1, 0, 0, 0];
    const ry = [0, 0, 0, lng, lat, 1];
    for (const row of [rx, ry]) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) ATA[i][j] += weight * row[i] * row[j];
      }
    }
    for (let i = 0; i < 3; i++) ATb[i] += weight * rx[i] * tx;
    ATb[3] += weight * lng * ty;
    ATb[4] += weight * lat * ty;
    ATb[5] += weight * ty;
  }
  const M = ATA.map((r, i) => [...r, ATb[i]]);
  for (let col = 0; col < 6; col++) {
    let piv = col;
    for (let r = col + 1; r < 6; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const div = M[col][col];
    for (let j = col; j < 7; j++) M[col][j] /= div;
    for (let r = 0; r < 6; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j < 7; j++) M[r][j] -= f * M[col][j];
    }
  }
  const p = M.map((r) => r[6]);
  return [p.slice(0, 3), p.slice(3, 6)];
}

/** Keep in sync with lib/travel-geo.ts applyProjectionBands */
function applyProjectionBands(lng, lat, x, y) {
  if (lng >= 120 && lng <= 122 && lat >= 30 && lat <= 32) y += 8;
  if (lat < 24) y -= (24 - lat) * 1.2;
  if (lng >= 115 && lat >= 45) y -= 8 + (lat - 45) * 4;
  if (lng < 100) x += (100 - lng) * 0.25;
  return [x, y];
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
  哈尔滨: [126.534, 45.8038],
  海拉尔: [119.7658, 49.2116],
  乌鲁木齐: [87.6168, 43.8256],
  敦煌: [94.6619, 40.1421],
  拉萨: [91.1322, 29.6604],
};

/** Rough WGS84 bounds per province for placing cities on SVG paths. */
const PROV_BOUNDS = {
  heilongjiang: { minLng: 121, maxLng: 135, minLat: 43, maxLat: 53 },
  "nei-mongol": { minLng: 97, maxLng: 126, minLat: 37, maxLat: 53 },
  "xinjiang-uygur": { minLng: 73, maxLng: 96, minLat: 34, maxLat: 49 },
  gansu: { minLng: 92, maxLng: 109, minLat: 32, maxLat: 43 },
  xizang: { minLng: 78, maxLng: 99, minLat: 27, maxLat: 37 },
};

function provinceBBox(id) {
  const loc = chinaMap.locations.find((l) => l.id === id);
  const pts = pathPoints(loc.path);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Place a city on the map from lng/lat within province bounds (north = smaller y). */
function cityInProvince(lng, lat, provinceId) {
  const b = provinceBBox(provinceId);
  const pb = PROV_BOUNDS[provinceId];
  const tx = (lng - pb.minLng) / (pb.maxLng - pb.minLng);
  const ty = (lat - pb.minLat) / (pb.maxLat - pb.minLat);
  return [
    b.minX + tx * (b.maxX - b.minX),
    b.minY + (1 - ty) * (b.maxY - b.minY),
  ];
}

/** Manual SVG anchors for cities where province centroids drift (small NW / inland nudge). */
const MANUAL_TARGETS = {
  上海: [607.73, 388],
  西双版纳: [338, 503],
  北海: [443, 518],
  三亚: [450, 566],
  台北: [604.38, 475.61],
  哈尔滨: cityInProvince(126.534, 45.8038, "heilongjiang"),
  海拉尔: cityInProvince(119.7658, 49.2116, "nei-mongol"),
  乌鲁木齐: cityInProvince(87.6168, 43.8256, "xinjiang-uygur"),
  敦煌: cityInProvince(94.6619, 40.1421, "gansu"),
  拉萨: cityInProvince(91.1322, 29.6604, "xizang"),
};

const refs = [
  ["上海", "manual", 20],
  ["北京", "beijing", 0.5],
  ["广州", "guangdong", 0.5],
  ["昆明", "yunnan", 0.5],
  ["成都", "sichuan", 0.5],
  ["西安", "shaanxi", 0.5],
  ["台北", "manual", 6],
  ["西双版纳", "manual", 12],
  ["北海", "manual", 12],
  ["三亚", "manual", 12],
  ["哈尔滨", "manual", 2],
  ["海拉尔", "manual", 2],
  ["乌鲁木齐", "manual", 3],
  ["敦煌", "manual", 2],
  ["拉萨", "manual", 2],
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

const [PROJECT_X, PROJECT_Y] = solve6(rows);

console.log("PROJECT_X =", JSON.stringify(PROJECT_X));
console.log("PROJECT_Y =", JSON.stringify(PROJECT_Y));

function project(ll) {
  const [lng, lat] = ll;
  const x = PROJECT_X[0] * lng + PROJECT_X[1] * lat + PROJECT_X[2];
  const y = PROJECT_Y[0] * lng + PROJECT_Y[1] * lat + PROJECT_Y[2];
  return applyProjectionBands(lng, lat, x, y);
}

for (const row of rows) {
  const p = project(row.ll);
  const err = Math.hypot(row.map[0] - p[0], row.map[1] - p[1]);
  console.log(`${row.name}: err ${err.toFixed(1)}px ->`, p.map((v) => v.toFixed(1)));
}

console.log("--- check ---");
for (const name of [
  "西双版纳",
  "北海",
  "三亚",
  "台北",
  "上海",
  "哈尔滨",
  "海拉尔",
  "乌鲁木齐",
  "敦煌",
  "拉萨",
]) {
  const ll = COORDS[name];
  if (!ll) continue;
  console.log(name, project(ll).map((v) => v.toFixed(1)));
}
