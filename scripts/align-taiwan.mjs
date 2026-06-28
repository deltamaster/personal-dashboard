/**
 * Shift Taiwan overlay (main island only) so a north-coast anchor matches Taipei route dot.
 * Usage: node scripts/align-taiwan.mjs
 */
import { TAIWAN_GROUP_TRANSFORM, TAIWAN_PATH } from "../lib/china-map-extras.ts";
import { resolveProjectedPoint } from "../lib/travel-geo.ts";

function pathNums(tok) {
  return (tok.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
}

function parseSubpaths(d) {
  const subs = [];
  let cur = [];
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
      if (cur.length) subs.push(cur);
      cur = [];
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
        cur.push([x, y]);
      }
    } else if (C === "L") {
      for (let i = 0; i < nums.length; i += 2) {
        x = rel ? x + nums[i] : nums[i];
        y = rel ? y + nums[i + 1] : nums[i + 1];
        cur.push([x, y]);
      }
    } else if (C === "H") {
      for (const n of nums) {
        x = rel ? x + n : n;
        cur.push([x, y]);
      }
    } else if (C === "V") {
      for (const n of nums) {
        y = rel ? y + n : n;
        cur.push([x, y]);
      }
    } else if (C === "C") {
      for (let i = 0; i < nums.length; i += 6) {
        x = rel ? x + nums[i + 4] : nums[i + 4];
        y = rel ? y + nums[i + 5] : nums[i + 5];
        cur.push([x, y]);
      }
    } else if (C === "Z") {
      x = startX;
      y = startY;
    }
  }
  if (cur.length) subs.push(cur);
  return subs;
}

function mainIslandPath() {
  const subs = parseSubpaths(TAIWAN_PATH);
  return subs.reduce((best, sub) => (sub.length > best.length ? sub : best));
}

function parseTransform(s) {
  const m = s.match(
    /translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/
  );
  return { tx: +m[1], ty: +m[2], sx: +m[3], sy: +m[4] };
}

function toView([x, y], tw) {
  return [(x + tw.tx) * tw.sx, (y + tw.ty) * tw.sy];
}

/** Taipei sits on the north coast, slightly west of island center. */
function taipeiAnchor(tw) {
  const viewPts = mainIslandPath().map((p) => toView(p, tw));
  const xs = viewPts.map((p) => p[0]);
  const ys = viewPts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const targetX = minX + (maxX - minX) * 0.22;
  const targetY = minY + (maxY - minY) * 0.12;
  return viewPts.reduce((best, p) => {
    const d = (p[0] - targetX) ** 2 + (p[1] - targetY) ** 2;
    const bd = (best[0] - targetX) ** 2 + (best[1] - targetY) ** 2;
    return d < bd ? p : best;
  });
}

const tw = parseTransform(TAIWAN_GROUP_TRANSFORM);
const route = resolveProjectedPoint("中国台北桃园");
const anchorBefore = taipeiAnchor(tw);
const dx = route[0] - anchorBefore[0];
const dy = route[1] - anchorBefore[1];
const newTx = tw.tx + dx / tw.sx;
const newTy = tw.ty + dy / tw.sy;
const twNew = { ...tw, tx: newTx, ty: newTy };
const anchorAfter = taipeiAnchor(twNew);

console.log("route", route.map((v) => v.toFixed(2)));
console.log("anchor before", anchorBefore.map((v) => v.toFixed(2)));
console.log("delta view", dx.toFixed(2), dy.toFixed(2));
console.log(
  `translate(${newTx.toFixed(3)}, ${newTy.toFixed(3)}) scale(${tw.sx}, ${tw.sy})`
);
console.log("anchor after", anchorAfter.map((v) => v.toFixed(2)));
