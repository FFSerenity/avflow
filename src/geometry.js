import { GRID, snapG, PAD_W, BODY_W, STUB_W, DOT_R, HEADER_H, ROW_H } from "./constants.js";

// ── Pin expansion & positioning ───────────────────────────────────────────
export function expandGroups(groups) {
  const pins = [];
  (groups || []).forEach(g => {
    const base = (g.description && g.description.trim()) ? g.description.trim() : g.signal;
    for (let i = 1; i <= Math.max(1, g.qty); i++) {
      pins.push({
        id: `${g.id}-${i}`, groupId: g.id, signal: g.signal,
        connector: g.connector, direction: g.direction, side: g.side,
        description: g.qty > 1 ? `${base} ${String(i).padStart(2,"0")}` : base,
      });
    }
  });
  return pins;
}

export function getPinPositions(block) {
  const pins = expandGroups(block.eq.groups || []);
  const leftPins  = pins.filter(p => p.side === "left");
  const rightPins = pins.filter(p => p.side === "right");
  const positions = {};
  leftPins.forEach((p, i) => {
    const y = block.y + HEADER_H + i * ROW_H + ROW_H / 2;
    const x = block.x + PAD_W - STUB_W - DOT_R;
    positions[p.id] = { x, y, pin: p };
  });
  rightPins.forEach((p, i) => {
    const y = block.y + HEADER_H + i * ROW_H + ROW_H / 2;
    const x = block.x + PAD_W + BODY_W + STUB_W + DOT_R;
    positions[p.id] = { x, y, pin: p };
  });
  return positions;
}

// ── Text measurement ──────────────────────────────────────────────────────
let _measureCtx = null;
export function measureText(str, fontSize) {
  if (!_measureCtx) {
    try { _measureCtx = document.createElement("canvas").getContext("2d"); }
    catch(e) { return str.length * 7.5; }
  }
  _measureCtx.font = `500 ${fontSize}px system-ui, sans-serif`;
  return _measureCtx.measureText(str).width;
}

// ── Wire routing ──────────────────────────────────────────────────────────
export function defaultVx(x1, x2) { return snapG((x1 + x2) / 2); }

export function smartVx(fp, tp) {
  if (!fp || !tp) return defaultVx(fp?.x ?? 0, tp?.x ?? 0);
  const x1 = fp.x, x2 = tp.x;
  const s1 = fp.pin?.side, s2 = tp.pin?.side;
  const CLEARANCE = GRID * 3;
  if (s1 === "left"  && s2 === "left")  return snapG(Math.min(x1, x2) - CLEARANCE);
  if (s1 === "right" && s2 === "right") return snapG(Math.max(x1, x2) + CLEARANCE);
  return snapG((x1 + x2) / 2);
}

export function buildWaypoints(x1, y1, x2, y2, vx, turns) {
  turns = turns || [];
  if (turns.length === 0) {
    const v = vx ?? defaultVx(x1, x2);
    return [{x:x1,y:y1},{x:v,y:y1},{x:v,y:y2},{x:x2,y:y2}];
  }
  const pts = [{x:x1, y:y1}];
  let curY = y1;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    pts.push({x:t.vx1, y:curY});
    pts.push({x:t.vx1, y:t.vy});
    pts.push({x:t.vx2, y:t.vy});
    const nextY = (i < turns.length - 1) ? turns[i+1].vy : y2;
    pts.push({x:t.vx2, y:nextY});
    curY = nextY;
  }
  pts.push({x:x2, y:y2});
  return pts.filter((p,i) => i===0 || p.x!==pts[i-1].x || p.y!==pts[i-1].y);
}

export function buildPath(pts) {
  return pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
}

export function addTurn(x1, y1, x2, y2, vx, turns) {
  turns = turns || [];
  const pts = buildWaypoints(x1, y1, x2, y2, vx, turns);
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i-1], p1 = pts[i];
    if (p0.y === p1.y) {
      const len = Math.abs(p1.x - p0.x);
      if (!best || len > best.len) best = {x0:p0.x, x1:p1.x, y:p0.y, len};
    }
  }
  if (!best || best.len < GRID * 4) return turns;
  const dx = best.x1 - best.x0;
  const newVx1 = snapG(best.x0 + dx * 0.35);
  const newVx2 = snapG(best.x0 + dx * 0.65);
  const midY = (y1 + y2) / 2;
  const newVy = snapG(best.y + (best.y < midY ? GRID * 3 : -GRID * 3));
  const result = [...turns, {vx1: newVx1, vx2: newVx2, vy: newVy}];
  result.sort((a, b) => a.vx1 - b.vx1);
  return result;
}

export function removeTurn(x1, y1, x2, y2, vx, turns, cx, cy) {
  if (!turns || turns.length === 0) return turns;
  let bestIdx = 0, bestDist = Infinity;
  turns.forEach((t, i) => {
    const midX = (t.vx1 + t.vx2) / 2;
    const dist = Math.abs(cx - midX) + Math.abs(cy - t.vy) * 2;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  });
  return turns.filter((_, i) => i !== bestIdx);
}

export function normalizeWire(w, x1, x2) {
  const vx = w.feather ? w.vx
                       : (w.vx != null ? w.vx : snapG((w.vxList?.[0]) ?? defaultVx(x1, x2)));
  return { ...w, vx, turns: w.turns || [] };
}

// ── Cloud path (AutoCAD revision cloud) ──────────────────────────────────
export function cloudPath(x1, y1, x2, y2) {
  const ARC_LEN = 20;
  const pts = [];
  const edges = [
    [x1,y1, x2,y1],
    [x2,y1, x2,y2],
    [x2,y2, x1,y2],
    [x1,y2, x1,y1],
  ];
  edges.forEach(([ax,ay,bx,by]) => {
    const len = Math.sqrt((bx-ax)**2+(by-ay)**2);
    const n = Math.max(2, Math.round(len / ARC_LEN));
    for(let i=0;i<n;i++) pts.push([ax+(bx-ax)*i/n, ay+(by-ay)*i/n]);
  });
  const R = ARC_LEN * 0.6;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for(let i=0;i<pts.length;i++){
    const [x,y]=pts[i], [nx,ny]=pts[(i+1)%pts.length];
    d+=` A${R.toFixed(1)},${R.toFixed(1)} 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}`;
  }
  return d+"Z";
}

// ── Pin label for feather tags ────────────────────────────────────────────
export function pinLabel(block, pinId) {
  if (!block) return "";
  const sysName = block.systemName || block.eq?.systemName || "";
  const pins = expandGroups(block.eq?.groups || []);
  const pin = pins.find(p => p.id === pinId);
  const desc = pin?.description || pin?.connector || "";
  return `${sysName} ${desc}`.trim();
}

// ── System name helpers ───────────────────────────────────────────────────
export function getPrefix(sysName) {
  if (!sysName) return "EQ";
  const m = sysName.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : "EQ";
}

export function getNextSysName(prefix, usedNames) {
  const nameSet = usedNames instanceof Set ? usedNames : new Set(usedNames);
  let i = 1;
  while (nameSet.has(`${prefix}${String(i).padStart(2,"0")}`)) i++;
  return `${prefix}${String(i).padStart(2,"0")}`;
}

// ── Wire crossing arc helpers ─────────────────────────────────────────────
// buildHPath and buildVPathWithArcs power the two-pass wire render in Canvas.jsx
// that keeps vertical segments always on top of horizontal ones.

// Build an SVG path string for HORIZONTAL segments only.
// Used in pass 1 (bottom layer) of the wire render.
export function buildHPath(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    if (p0.y === p1.y) d += `M${p0.x},${p0.y} L${p1.x},${p1.y} `;
  }
  return d.trim();
}

// Build an SVG path string for VERTICAL segments only, inserting a
// right-bowing (concave-left) semicircular arc wherever this wire's
// vertical segment crosses another wire's horizontal segment.
//
// hSegs — H segments from OTHER wires: [{ x1, x2, y, wireId }, ...]
// R     — arc radius in px; default = GRID / 2 = 8
//
// Arc direction:
//   going down → clockwise arc (sweep=1)  → bows RIGHT
//   going up   → counter-clockwise (sweep=0) → also bows RIGHT
//
// Clearance rule: if two crossings on the same V segment are < 2R apart,
// both arcs are skipped (straight line passes through instead).
export function buildVPathWithArcs(pts, hSegs, R = 6) {
  const DIAM = R * 2;
  let d = '';

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    if (p0.x !== p1.x) continue;           // horizontal segment — skip

    const x         = p0.x;
    const yMin      = Math.min(p0.y, p1.y);
    const yMax      = Math.max(p0.y, p1.y);
    const goingDown = p1.y > p0.y;

    // Find H segments from other wires that cross this V segment
    const rawYs = hSegs
      .filter(hs => hs.x1 < x && x < hs.x2 && hs.y > yMin && hs.y < yMax)
      .map(hs => hs.y)
      .sort((a, b) => a - b);

    // Discard crossings too close to the segment's own endpoints
    const segYs = rawYs.filter(y => y > yMin + R && y < yMax - R);

    // Clearance filter — skip any crossing whose nearest neighbour is < 2R away
    const filteredYs = segYs.filter((y, j) => {
      const prev = segYs[j - 1];
      const next = segYs[j + 1];
      if (prev !== undefined && y - prev < DIAM) return false;
      if (next !== undefined && next - y < DIAM) return false;
      return true;
    });

    // Order crossings in the direction of travel
    const orderedYs = goingDown ? filteredYs : [...filteredYs].reverse();

    d += `M${x},${p0.y} `;
    for (const cy of orderedYs) {
      const arcEntry = goingDown ? cy - R : cy + R;
      const arcExit  = goingDown ? cy + R : cy - R;
      const sweep    = goingDown ? 1 : 0;
      d += `L${x},${arcEntry} A${R},${R} 0 0 ${sweep} ${x},${arcExit} `;
    }
    d += `L${x},${p1.y} `;
  }

  return d.trim();
}
