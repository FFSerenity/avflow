import { useState, useRef, useCallback, useEffect } from "react";
import { SIGNAL_COLORS, CABLE_PREFIX, GRID, snap, snapG, ROW_H, HEADER_H, FOOTER_H, BODY_W, PAD_W, STUB_W, DOT_R, ANNOT_COLORS } from "./constants.js";
import { expandGroups, getPinPositions, measureText, defaultVx, smartVx, buildWaypoints, buildPath, buildHPath, buildVPathWithArcs, addTurn, removeTurn, normalizeWire, cloudPath, pinLabel, getPrefix, getNextSysName } from "./geometry.js";
import BlockView from "./components/BlockView.jsx";
import Sidebar, { SAMPLE_LIBRARY } from "./components/Sidebar.jsx";






// ── Main canvas ────────────────────────────────────────────────────────────

// ── Annotation tool registry ──────────────────────────────────────────────
const ANNOT_TOOLS = [
  { id:"text",      label:"Text note",  cursor:"text",
    icon:<text x="50%" y="72%" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fontSize={11} fontWeight="700" fontFamily="system-ui">T</text> },
  { id:"leader",    label:"Leader",     cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><line x1="2" y1="14" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5"/><polygon points="2,14 5,9 7,12" fill="currentColor"/><line x1="12" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id:"rect",      label:"Rectangle",  cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><rect x="1" y="3" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id:"ellipse",   label:"Ellipse",    cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><ellipse cx="8" cy="8" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id:"cloud",     label:"Cloud",      cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><path d="M2,12 Q3,8 6,9 Q7,5 10,6 Q12,3 14,6 Q16,5 16,9 Q16,12 2,12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id:"arrow",     label:"Arrow",      cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5"/><polygon points="14,2 9,4 12,7" fill="currentColor"/></svg> },
  { id:"dimension", label:"Dimension",  cursor:"crosshair",
    icon:<svg viewBox="0 0 16 16" width="14" height="14"><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="5" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5"/><line x1="15" y1="5" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5"/></svg> },
];



let _blockId  = 1;
let _wireId   = 1;
let _cableIdx = 1;
let _locBoxId = 1;
let _spareId  = 1;
let _spareCableIdx = 1;
let _annotId  = 1;

export default function AVCanvas() {
  const canvasRef   = useRef(null);
  const [blocks, setBlocks]   = useState([]);
  const [wires,  setWires]    = useState([]);
  const [spares, setSpares]   = useState([]); // spare cable runs between loc boxes
  const [pan,    setPan]      = useState({ x:0, y:0 });
  const [zoom,   setZoom]     = useState(1);

  // Multi-select: sets of block IDs and wire IDs
  const [selBlocks, setSelBlocks] = useState(new Set());
  const [selWires,  setSelWires]  = useState(new Set());
  const selBlocksRef = useRef(new Set());
  const selWiresRef  = useRef(new Set());
  const setSB = (val) => { selBlocksRef.current = val; setSelBlocks(val); };
  const setSW = (val) => { selWiresRef.current  = val; setSelWires(val);  };
  const clearSel = () => { setSB(new Set()); setSW(new Set()); setSelLocBoxes(new Set()); };

  // Marquee selection box
  const [marquee, setMarquee] = useState(null); // {x1,y1,x2,y2} in canvas coords
  const marqueeRef = useRef(null);

  // Location boxes
  const [locBoxes, setLocBoxes] = useState([]);
  const [spareDrawing, setSpareDrawing] = useState(null); // { fromLocBoxId, signal, qty, length }
  const [spareModal, setSpareModal]     = useState(null); // { fromLocBoxId, x, y } — config dialog
  const [selLocBoxes, setSelLocBoxesState] = useState(new Set());
  const selLocBoxesRef = useRef(new Set());
  const setSelLocBoxes = (val) => { selLocBoxesRef.current = val; setSelLocBoxesState(val); };
  const [editingLocBox, setEditingLocBoxState] = useState(null);
  const editingLocBoxRef = useRef(null);
  const setEditingLocBox = (v) => { editingLocBoxRef.current = v; setEditingLocBoxState(v); };
  const locBoxDrag = useRef(null);

  // Annotation tools
  const [annotations, setAnnotations] = useState([]);
  const [selAnnots, setSelAnnotsState] = useState(new Set());
  const selAnnotsRef = useRef(new Set());
  const setSelAnnots = (val) => { selAnnotsRef.current = val; setSelAnnotsState(val); };
  const [editingAnnot, setEditingAnnotState] = useState(null);
  const editingAnnotRef = useRef(null);
  const setEditingAnnot = (v) => { editingAnnotRef.current = v; setEditingAnnotState(v); };
  const [activeTool, setActiveTool] = useState(null);
  const [lastTool,   setLastTool]   = useState(null);   // persists after placement
  const [annotColor, setAnnotColor] = useState("#ffffff");
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const annotDraw = useRef(null);   // {tool, color, x0,y0, x1,y1} while drawing
  const annotDrag = useRef(null);   // {id, startX,startY, origAnnot} while moving
  const annotWasDragged = useRef(false); // true once annotation drag moves > threshold
  const [annotDrawState, setAnnotDrawState] = useState(null); // for live preview

  const [contextMenu, setContextMenu] = useState(null);
  const [ipInfoModal, setIpInfoModal] = useState(null); // { blockId, x, y }

  // Wire drawing state — use ref for current value in event handlers, state for re-render
  const [drawing, setDrawingState]   = useState(null);
  const drawingRef = useRef(null);
  const setDrawing = (val) => { drawingRef.current = val; setDrawingState(val); };

  // Feather drawing state (right-click drag/click on pin)
  const [featherDrawing, setFeatherDrawingState] = useState(null);
  const featherDrawingRef = useRef(null);
  const setFeatherDrawing = (val) => { featherDrawingRef.current = val; setFeatherDrawingState(val); };

  const [hoveredPin, setHoveredPin] = useState(null); // { blockId, pinId }

  // Equipment swap state
  const [swapModal,       setSwapModal]       = useState(null); // { blockId }
  const [swapSearch,      setSwapSearch]       = useState('');
  const [swapCat,         setSwapCat]          = useState('All');
  const [swapMfr,         setSwapMfr]          = useState('All');
  const [orphanWires,     setOrphanWires]      = useState([]);   // persisted orphan ends
  const [draggingOrphan,  setDraggingOrphan]   = useState(null); // { orphanId, mouseCanvasX, mouseCanvasY }
  const draggingOrphanRef = useRef(null);


  // Equipment swap state


  // Wire segment dragging
  const wireDrag = useRef(null); // { wireId, startMouseX, startVx }

  // Drag state
  const dragging = useRef(null); // { blockId, startMouseX, startMouseY, startBlockX, startBlockY }
  const panning  = useRef(null); // { startMouseX, startMouseY, startPanX, startPanY }
  const mouseDownPos = useRef(null); // { x, y } — to distinguish click vs drag

  // Convert screen coords → canvas coords
  const toCanvas = useCallback((sx, sy) => ({
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  }), [pan, zoom]);

  // Get all pin positions for all blocks
  const allPinPositions = useCallback(() => {
    const map = {};
    blocks.forEach(b => {
      const pp = getPinPositions(b);
      Object.entries(pp).forEach(([pid, pos]) => {
        map[`${b.id}::${pid}`] = { ...pos, blockId: b.id, pinId: pid };
      });
    });
    return map;
  }, [blocks]);

  // Block bounding box in canvas coords
  const blockBBox = (b) => {
    const W = PAD_W + BODY_W + PAD_W;
    const pins = expandGroups(b.eq.groups || []);
    const rows = Math.max(pins.filter(p=>p.side==="left").length, pins.filter(p=>p.side==="right").length, 1);
    const H = HEADER_H + rows * ROW_H + FOOTER_H;
    return { x: b.x, y: b.y, w: W, h: H };
  };

  // Find wire near a canvas point (hit test using midpoint proximity)
  const findWire = useCallback((cx, cy) => {
    const HIT_H = 4;  // tight hit on horizontal segments (avoids overlap with close wires)
    const HIT_V = 6;  // slightly wider on vertical segments (easier to click)
    for (const w of wireEndpointsRef.current) {
      if (w.feather) continue; // feathers handle their own clicks
      const vx = w.vx != null ? w.vx : defaultVx(w.x1, w.x2);
      const turns = w.turns || [];
      const pts = buildWaypoints(w.x1, w.y1, w.x2, w.y2, vx, turns);
      for (let i = 1; i < pts.length; i++) {
        const p0=pts[i-1], p1=pts[i];
        if (p0.y===p1.y) {
          // Horizontal segment — tight vertical hit zone
          const minX=Math.min(p0.x,p1.x), maxX=Math.max(p0.x,p1.x);
          if (Math.abs(cy-p0.y)<HIT_H && cx>=minX-HIT_V && cx<=maxX+HIT_V) return w;
        } else {
          // Vertical segment
          const minY=Math.min(p0.y,p1.y), maxY=Math.max(p0.y,p1.y);
          if (Math.abs(cx-p0.x)<HIT_V && cy>=minY-HIT_H && cy<=maxY+HIT_H) return w;
        }
      }
    }
    return null;
  }, []);

  // Find pin near canvas point (within hitRadius)
  // excludeKey: "blockId::pinId" composite — prevents connecting a pin to itself only
  const findPin = useCallback((cx, cy, excludeBlockId, excludePinId) => {
    const HIT = 10;
    const pinMap = allPinPositions();
    for (const [key, pos] of Object.entries(pinMap)) {
      if (excludeBlockId && excludePinId &&
          pos.blockId === excludeBlockId && pos.pinId === excludePinId) continue;
      if (Math.abs(pos.x - cx) < HIT && Math.abs(pos.y - cy) < HIT) return pos;
    }
    return null;
  }, [allPinPositions]);

  // Find pin near canvas point INCLUDING own block (for hover)
  const findPinAny = useCallback((cx, cy) => {
    const HIT = 10;
    const pinMap = allPinPositions();
    for (const [key, pos] of Object.entries(pinMap)) {
      if (Math.abs(pos.x - cx) < HIT && Math.abs(pos.y - cy) < HIT) return pos;
    }
    return null;
  }, [allPinPositions]);

  // ── Mouse events on canvas ────────────────────────────────────────────────
  const onCanvasMouseMove = useCallback((e) => {
    // Orphan drag — update mouse canvas position
    if (draggingOrphanRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top  - pan.y) / zoom;
      draggingOrphanRef.current = { ...draggingOrphanRef.current, mouseCanvasX: cx, mouseCanvasY: cy };
      setDraggingOrphan({ ...draggingOrphanRef.current });
      const p = findPin(cx, cy);
      setHoveredPin(p ? { blockId: p.blockId, pinId: p.pinId } : null);
      return;
    }
    // Block canvas interactions while text editing
    if (editingAnnotRef.current || editingLocBoxRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: cx, y: cy } = toCanvas(sx, sy);

    // Pan
    if (panning.current) {
      const dx = sx - panning.current.startMouseX;
      const dy = sy - panning.current.startMouseY;
      setPan({ x: panning.current.startPanX + dx, y: panning.current.startPanY + dy });
      return;
    }

    // Drag annotation
    if (annotDrag.current) {
      const ad = annotDrag.current;
      const dx = (sx - ad.startX) / zoom;
      const dy = (sy - ad.startY) / zoom;
      annotWasDragged.current = true; // moved — suppress click handler
      // Move all selected annotations
      setAnnotations(as => as.map(a => {
        if (!ad.selAnnotIds.has(a.id)) return a;
        if (!ad.startAnnotPositions[a.id]) {
          ad.startAnnotPositions[a.id] = { x: a.x, y: a.y, x2: a.x2, y2: a.y2 };
        }
        const s = ad.startAnnotPositions[a.id];
        return { ...a,
          x: snapG(s.x + dx), y: snapG(s.y + dy),
          x2: s.x2 != null ? snapG(s.x2 + dx) : undefined,
          y2: s.y2 != null ? snapG(s.y2 + dy) : undefined,
        };
      }));
      // Move selected blocks
      if (ad.selBlockIds && ad.selBlockIds.size > 0) {
        setBlocks(bs => bs.map(b => {
          if (!ad.selBlockIds.has(b.id)) return b;
          if (!ad.startBlockPositions[b.id]) {
            ad.startBlockPositions[b.id] = { x: b.x, y: b.y };
          }
          const s = ad.startBlockPositions[b.id];
          return { ...b, x: snap(s.x + dx), y: snap(s.y + dy) };
        }));
      }
      // Wires where both ends are selected — shift vx by dx
      if (ad.startWireVx && Object.keys(ad.startWireVx).length > 0) {
        setWires(ws => ws.map(w => {
          const sv = ad.startWireVx[w.id];
          if (!sv) return w;
          const newVx = sv.vx != null ? snapG(sv.vx + dx) : null;
          const newTurns = sv.turns.map(t => ({
            ...t, vx1: snapG(t.vx1 + dx), vx2: snapG(t.vx2 + dx), vy: snapG(t.vy + dy),
          }));
          return { ...w, vx: newVx, turns: newTurns };
        }));
      }
      // Move selected loc boxes
      if (ad.selLbIds && ad.selLbIds.size > 0) {
        setLocBoxes(lbs => lbs.map(lb => {
          if (!ad.selLbIds.has(lb.id)) return lb;
          if (!ad.startLocBoxPositions[lb.id]) {
            ad.startLocBoxPositions[lb.id] = { x: lb.x, y: lb.y };
          }
          const s = ad.startLocBoxPositions[lb.id];
          return { ...lb, x: snap(s.x + dx), y: snap(s.y + dy) };
        }));
      }
      return;
    }

    // Live preview while drawing annotation
    if (annotDraw.current) {
      const { x: cx2, y: cy2 } = toCanvas(sx, sy);
      annotDraw.current = { ...annotDraw.current, x1: snapG(cx2), y1: snapG(cy2) };
      setAnnotDrawState({ ...annotDraw.current });
      return;
    }

    // Drag block(s) + selected annotations + selected loc boxes together
    if (dragging.current) {
      const dr = dragging.current;
      const dx = (sx - dr.startMouseX) / zoom;
      const dy = (sy - dr.startMouseY) / zoom;
      // Blocks
      const sp = dr.startPositions;
      setBlocks(bs => bs.map(b => {
        if (!sp[b.id]) return b;
        return { ...b, x: snap(sp[b.id].x + dx), y: snap(sp[b.id].y + dy) };
      }));
      // Wires where both ends are selected — shift vx and turn vx1/vx2 by dx
      if (dr.startWireVx && Object.keys(dr.startWireVx).length > 0) {
        setWires(ws => ws.map(w => {
          const sv = dr.startWireVx[w.id];
          if (!sv) return w;
          const newVx = sv.vx != null ? snapG(sv.vx + dx) : null;
          const newTurns = sv.turns.map(t => ({
            ...t,
            vx1: snapG(t.vx1 + dx),
            vx2: snapG(t.vx2 + dx),
            vy:  snapG(t.vy  + dy),
          }));
          return { ...w, vx: newVx, turns: newTurns };
        }));
      }
      // Annotations — lazily capture start on first move
      if (dr.selAnnotIds && dr.selAnnotIds.size > 0) {
        setAnnotations(as => as.map(a => {
          if (!dr.selAnnotIds.has(a.id)) return a;
          if (!dr.startAnnotPositions[a.id]) {
            dr.startAnnotPositions[a.id] = { x: a.x, y: a.y, x2: a.x2, y2: a.y2 };
          }
          const s = dr.startAnnotPositions[a.id];
          return { ...a,
            x: snapG(s.x + dx), y: snapG(s.y + dy),
            x2: s.x2 != null ? snapG(s.x2 + dx) : undefined,
            y2: s.y2 != null ? snapG(s.y2 + dy) : undefined,
          };
        }));
      }
      // Loc boxes — lazily capture start on first move
      if (dr.selLbIds && dr.selLbIds.size > 0) {
        setLocBoxes(lbs => lbs.map(lb => {
          if (!dr.selLbIds.has(lb.id)) return lb;
          if (!dr.startLocBoxPositions[lb.id]) {
            dr.startLocBoxPositions[lb.id] = { x: lb.x, y: lb.y };
          }
          const s = dr.startLocBoxPositions[lb.id];
          return { ...lb, x: snap(s.x + dx), y: snap(s.y + dy) };
        }));
      }
      return;
    }

    // Drag location box
    if (locBoxDrag.current) {
      const lbd = locBoxDrag.current;
      const dx = (sx - lbd.startX) / zoom;
      const dy = (sy - lbd.startY) / zoom;
      if (lbd.type === 'move') {
        // Move all selected loc boxes
        setLocBoxes(lbs => lbs.map(lb => {
          if (!lbd.selIds || !lbd.selIds.has(lb.id)) return lb;
          if (!lbd.startBoxes) lbd.startBoxes = {};
          if (!lbd.startBoxes[lb.id]) lbd.startBoxes[lb.id] = { x: lb.x, y: lb.y };
          return { ...lb,
            x: snap(lbd.startBoxes[lb.id].x + dx),
            y: snap(lbd.startBoxes[lb.id].y + dy)
          };
        }));
        // Move selected blocks
        if (lbd.selBlockIds && lbd.selBlockIds.size > 0) {
          setBlocks(bs => bs.map(b => {
            if (!lbd.selBlockIds.has(b.id)) return b;
            if (!lbd.startBlockPositions) lbd.startBlockPositions = {};
            if (!lbd.startBlockPositions[b.id]) lbd.startBlockPositions[b.id] = { x: b.x, y: b.y };
            return { ...b,
              x: snap(lbd.startBlockPositions[b.id].x + dx),
              y: snap(lbd.startBlockPositions[b.id].y + dy)
            };
          }));
        }
        // Wires where both ends are selected — shift vx by dx
        if (lbd.startWireVx && Object.keys(lbd.startWireVx).length > 0) {
          setWires(ws => ws.map(w => {
            const sv = lbd.startWireVx[w.id];
            if (!sv) return w;
            const newVx = sv.vx != null ? snapG(sv.vx + dx) : null;
            const newTurns = sv.turns.map(t => ({
              ...t, vx1: snapG(t.vx1 + dx), vx2: snapG(t.vx2 + dx), vy: snapG(t.vy + dy),
            }));
            return { ...w, vx: newVx, turns: newTurns };
          }));
        }
        // Move selected annotations
        if (lbd.selAnnotIds && lbd.selAnnotIds.size > 0) {
          setAnnotations(as => as.map(a => {
            if (!lbd.selAnnotIds.has(a.id)) return a;
            if (!lbd.startAnnotPositions) lbd.startAnnotPositions = {};
            if (!lbd.startAnnotPositions[a.id]) lbd.startAnnotPositions[a.id] = { x: a.x, y: a.y, x2: a.x2, y2: a.y2 };
            const s = lbd.startAnnotPositions[a.id];
            return { ...a,
              x: snapG(s.x + dx), y: snapG(s.y + dy),
              x2: s.x2 != null ? snapG(s.x2 + dx) : undefined,
              y2: s.y2 != null ? snapG(s.y2 + dy) : undefined,
            };
          }));
        }
      } else {
        // Edge resize — only on the primary loc box
        setLocBoxes(lbs => lbs.map(lb => {
          if (lb.id !== lbd.id) return lb;
          let { x, y, w, h } = lbd.startBox;
          const MIN = GRID * 4;
          if (lbd.edge.includes('l')) { const nw = Math.max(MIN, w - dx); x = x + w - nw; w = nw; }
          if (lbd.edge.includes('r')) { w = Math.max(MIN, w + dx); }
          if (lbd.edge.includes('t')) { const nh = Math.max(MIN, h - dy); y = y + h - nh; h = nh; }
          if (lbd.edge.includes('b')) { h = Math.max(MIN, h + dy); }
          return { ...lb, x: snap(x), y: snap(y), w: snap(w), h: snap(h) };
        }));
      }
      return;
    }

    // Wire drawing — update mouse position
    if (drawingRef.current) {
      setDrawing({ ...drawingRef.current, mouseX: cx, mouseY: cy });
      const target = findPin(cx, cy, drawingRef.current.fromBlockId, drawingRef.current.fromPinId);
      setHoveredPin(target ? { blockId: target.blockId, pinId: target.pinId } : null);
      return;
    }

    // Drag wire segment
    const wd = wireDrag.current;
    if (wd) {
      if (wd.type === 'feather_src_vx') {
        // startVal is an offset; delta applied to offset, stored as offset
        const newOffset = snapG(wd.startVal + (sx - wd.startMouseX) / zoom);
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, vx: newOffset } : w));
      } else if (wd.type === 'feather_dst_vx') {
        const newOffset = snapG(wd.startVal + (sx - wd.startMouseX) / zoom);
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, vx2: newOffset } : w));
      } else if (wd.type === 'feather_src_vy') {
        const newVy = snapG(wd.startVal + (sy - wd.startMouseY) / zoom);
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, srcVy: newVy } : w));
      } else if (wd.type === 'feather_dst_vy') {
        const newVy = snapG(wd.startVal + (sy - wd.startMouseY) / zoom);
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, dstVy: newVy } : w));
      } else if (wd.type === 'feather_src_vx2') {
        // drag chevron on new horizontal segment after bend
        const delta = (sx - wd.startMouseX) / zoom;
        const newOff = snapG(wd.startVal + (wd.srcGoRight ? delta : -delta));
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, srcVx2: Math.max(GRID, newOff) } : w));
      } else if (wd.type === 'feather_dst_vx2') {
        const delta = (sx - wd.startMouseX) / zoom;
        const newOff = snapG(wd.startVal + (wd.dstGoRight ? -delta : delta));
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, dstVx2: Math.max(GRID, newOff) } : w));
      } else if (wd.type === 'vx') {
        const newVx = snapG(wd.startVal + (sx - wd.startMouseX) / zoom);
        setWires(ws => ws.map(w => w.id === wd.wireId ? { ...w, vx: newVx } : w));
      } else if (wd.type === 'vx1' || wd.type === 'vx2') {
        const newV = snapG(wd.startVal + (sx - wd.startMouseX) / zoom);
        const field = wd.type; // 'vx1' or 'vx2'
        setWires(ws => ws.map(w => {
          if (w.id !== wd.wireId) return w;
          const turns = w.turns.map((t, i) =>
            i === wd.turnIdx ? { ...t, [field]: newV } : t
          );
          return { ...w, turns };
        }));
      } else if (wd.type === 'vy') {
        const newVy = snapG(wd.startVal + (sy - wd.startMouseY) / zoom);
        setWires(ws => ws.map(w => {
          if (w.id !== wd.wireId) return w;
          const turns = w.turns.map((t, i) =>
            i === wd.turnIdx ? { ...t, vy: newVy } : t
          );
          return { ...w, turns };
        }));
      }
      return;
    }

    // Update marquee
    if (marqueeRef.current) {
      const m = { ...marqueeRef.current, x2: cx, y2: cy };
      marqueeRef.current = m;
      setMarquee({ ...m });
      return;
    }

    // Update feather preview mouse position
    if (featherDrawingRef.current) {
      setFeatherDrawing({ ...featherDrawingRef.current, mouseX: cx, mouseY: cy });
    }

    // Hover detection — find nearest pin
    const p = findPinAny(cx, cy);
    setHoveredPin(p ? { blockId: p.blockId, pinId: p.pinId } : null);
  }, [toCanvas, zoom, drawing, findPin, findPinAny]);

  const onCanvasMouseDown = useCallback((e) => {
    // Block ALL canvas interactions while any text is being edited
    if (editingAnnotRef.current || editingLocBoxRef.current) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or alt+click = pan
      const rect = canvasRef.current.getBoundingClientRect();
      panning.current = { startMouseX: e.clientX - rect.left, startMouseY: e.clientY - rect.top, startPanX: pan.x, startPanY: pan.y };
      e.preventDefault();
      return;
    }
    // Right-click on a pin = start feather drawing
    if (e.button === 2) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: cx, y: cy } = toCanvas(sx, sy);
      // If feather drawing active, right-click also completes it (same as left)
      // If already feather-drawing, try to complete
      const curFeather = featherDrawingRef.current;
      if (curFeather) {
        const target = findPin(cx, cy, curFeather.fromBlockId, curFeather.fromPinId);
        if (target) {
          const srcBlock = blocks.find(b => b.id === curFeather.fromBlockId);
          const tgtBlock = blocks.find(b => b.id === target.blockId);
          const allSrc = expandGroups(srcBlock?.eq.groups || []);
          const allTgt = expandGroups(tgtBlock?.eq.groups || []);
          const sp = allSrc.find(p => p.id === curFeather.fromPinId);
          const tp = allTgt.find(p => p.id === target.pinId);
          const color = SIGNAL_COLORS[sp?.signal] || "#888";
          const mismatch = sp && tp && sp.signal !== tp.signal;
          const cableNum = `${CABLE_PREFIX[sp?.signal]||9}${String(_cableIdx++).padStart(3,"0")}`;
          const fp2 = srcBlock ? getPinPositions(srcBlock)[curFeather.fromPinId] : null;
          const tp2 = tgtBlock ? getPinPositions(tgtBlock)[target.pinId] : null;
          const initVx = smartVx(fp2, tp2);
          setWires(ws => [...ws, {
            id: `w-${_wireId++}`,
            fromBlockId: curFeather.fromBlockId, fromPinId: curFeather.fromPinId,
            toBlockId: target.blockId, toPinId: target.pinId,
            color: mismatch ? "#E24B4A" : color,
            dashed: mismatch, cableNum,
            signal: sp?.signal || "Other",
            vx: null, vx2: null, feather: true,
          }]);
        }
        setFeatherDrawing(null);
        setHoveredPin(null);
        e.preventDefault();
        return;
      }
      const p = findPinAny(cx, cy);
      if (p) {
        e.preventDefault();
        setFeatherDrawing({ fromBlockId: p.blockId, fromPinId: p.pinId, fromX: p.x, fromY: p.y });
        clearSel();
        return;
      }
      // Fall through to normal right-click (context menu handled by onContextMenu)
      return;
    }
    if (e.button === 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: cx, y: cy } = toCanvas(sx, sy);

      // Track position to distinguish click vs drag
      mouseDownPos.current = { x: cx, y: cy };

      // If already drawing (click mode) — try to complete wire on second click
      const currentDrawing = drawingRef.current;
      if (currentDrawing) {
        const target = findPin(cx, cy, currentDrawing.fromBlockId, currentDrawing.fromPinId);
        if (target) {
          const srcBlock = blocks.find(b => b.id === currentDrawing.fromBlockId);
          const tgtBlock = blocks.find(b => b.id === target.blockId);
          const allSrc = expandGroups(srcBlock?.eq.groups || []);
          const allTgt = expandGroups(tgtBlock?.eq.groups || []);
          const sp = allSrc.find(p => p.id === currentDrawing.fromPinId);
          const tp = allTgt.find(p => p.id === target.pinId);
          const color = SIGNAL_COLORS[sp?.signal] || "#888";
          const mismatch = sp && tp && sp.signal !== tp.signal;
          const cableNum = `${CABLE_PREFIX[sp?.signal]||9}${String(_cableIdx++).padStart(3,"0")}`;
          const fp2 = srcBlock ? getPinPositions(srcBlock)[currentDrawing.fromPinId] : null;
          const tp2 = tgtBlock ? getPinPositions(tgtBlock)[target.pinId] : null;
          const initVx = smartVx(fp2, tp2);
          setWires(ws => [...ws, {
            id: `w-${_wireId++}`,
            fromBlockId: currentDrawing.fromBlockId, fromPinId: currentDrawing.fromPinId,
            toBlockId: target.blockId, toPinId: target.pinId,
            color: mismatch ? "#E24B4A" : color,
            dashed: mismatch, cableNum,
            signal: sp?.signal || "Other",
            vx: initVx,
          }]);
        }
        // Always stop drawing on second click regardless
        setDrawing(null);
        setHoveredPin(null);
        return;
      }

      // If feather drawing is active, left-click completes it on a pin
      const curFeatherLc = featherDrawingRef.current;
      if (curFeatherLc) {
        const target = findPin(cx, cy, curFeatherLc.fromBlockId, curFeatherLc.fromPinId);
        if (target) {
          const srcBlock = blocks.find(b => b.id === curFeatherLc.fromBlockId);
          const tgtBlock = blocks.find(b => b.id === target.blockId);
          const allSrc = expandGroups(srcBlock?.eq.groups || []);
          const allTgt = expandGroups(tgtBlock?.eq.groups || []);
          const sp = allSrc.find(p => p.id === curFeatherLc.fromPinId);
          const tp = allTgt.find(p => p.id === target.pinId);
          const color = SIGNAL_COLORS[sp?.signal] || "#888";
          const mismatch = sp && tp && sp.signal !== tp.signal;
          const cableNum = `${CABLE_PREFIX[sp?.signal]||9}${String(_cableIdx++).padStart(3,"0")}`;
          const fpLc = srcBlock ? getPinPositions(srcBlock)[curFeatherLc.fromPinId] : null;
          const tpLc = tgtBlock ? getPinPositions(tgtBlock)[target.pinId] : null;
          const initVxLc = smartVx(fpLc, tpLc);
          setWires(ws => [...ws, {
            id: `w-${_wireId++}`,
            fromBlockId: curFeatherLc.fromBlockId, fromPinId: curFeatherLc.fromPinId,
            toBlockId: target.blockId, toPinId: target.pinId,
            color: mismatch ? "#E24B4A" : color,
            dashed: mismatch, cableNum,
            signal: sp?.signal || "Other",
            vx: null, vx2: null, feather: true,
          }]);
          setFeatherDrawing(null);
          setHoveredPin(null);
        } else {
          // Clicked empty space — cancel feather drawing
          setFeatherDrawing(null);
          setHoveredPin(null);
        }
        return;
      }

      // If spare drawing active — left-click near a loc box edge to complete
      if (spareDrawing) {
        let destLocBoxId = null, destEdgeY = 0;
        for (const lb of locBoxes) {
          const edgeTol = 12;
          if (Math.abs(cx - (lb.x + lb.w)) < edgeTol && cy >= lb.y && cy <= lb.y + lb.h) {
            destLocBoxId = lb.id; destEdgeY = snapG(cy - lb.y); break;
          }
          if (Math.abs(cx - lb.x) < edgeTol && cy >= lb.y && cy <= lb.y + lb.h) {
            destLocBoxId = lb.id; destEdgeY = snapG(cy - lb.y); break;
          }
        }
        if (destLocBoxId && destLocBoxId !== spareDrawing.fromLocBoxId) {
          const sig = spareDrawing.signal || Object.keys(SIGNAL_COLORS)[0];
          const pfx = CABLE_PREFIX[sig] || 9;
          const cableNum = `${pfx}S${String(_spareCableIdx++).padStart(2,"0")}`;
          setSpares(ss => [...ss, {
            id: `sp-${_spareId++}`,
            fromLocBoxId: spareDrawing.fromLocBoxId,
            fromEdgeY: spareDrawing.fromEdgeY,
            toLocBoxId: destLocBoxId,
            toEdgeY: destEdgeY,
            signal: sig,
            color: SIGNAL_COLORS[sig] || "#888780",
            qty: spareDrawing.qty || "1",
            length: spareDrawing.length || "",
            cableNum, vx: null, turns: [],
          }]);
          setSpareDrawing(null);
          return;
        }
        // Click elsewhere cancels
        if (!destLocBoxId) { setSpareDrawing(null); }
        return;
      }

      // Check if clicking a pin — start wire
      const p = findPinAny(cx, cy);
      if (p) {
        e.stopPropagation();
        setDrawing({ fromBlockId: p.blockId, fromPinId: p.pinId, fromX: p.x, fromY: p.y, mouseX: cx, mouseY: cy, isDrag: false });
        clearSel();
        return;
      }

      // Check if clicking a draggable wire segment
      let hitSeg = null;
      for (const we of wireEndpointsRef.current) {
        if (hitSeg) break;
        if (we.feather) continue;
        const vx = we.vx != null ? we.vx : defaultVx(we.x1, we.x2);
        const turns = we.turns || [];
        if (turns.length === 0) {
          const minY = Math.min(we.y1,we.y2), maxY = Math.max(we.y1,we.y2);
          if (Math.abs(cx-vx) < 6 && cy >= minY-4 && cy <= maxY+4) {
            hitSeg = { w:we, type:'vx', val:vx };
          }
        } else {
          for (let ti = 0; ti < turns.length && !hitSeg; ti++) {
            const t = turns[ti];
            const prevY = ti===0 ? we.y1 : turns[ti-1].vy;
            const nextY = ti===turns.length-1 ? we.y2 : turns[ti+1].vy;
            const v1minY=Math.min(prevY,t.vy), v1maxY=Math.max(prevY,t.vy);
            if (Math.abs(cx-t.vx1)<6 && cy>=v1minY-4 && cy<=v1maxY+4) {
              hitSeg={w:we,type:'vx1',turnIdx:ti,val:t.vx1};
            }
            const v2minY=Math.min(t.vy,nextY), v2maxY=Math.max(t.vy,nextY);
            if (!hitSeg && Math.abs(cx-t.vx2)<6 && cy>=v2minY-4 && cy<=v2maxY+4) {
              hitSeg={w:we,type:'vx2',turnIdx:ti,val:t.vx2};
            }
            const hMinX=Math.min(t.vx1,t.vx2), hMaxX=Math.max(t.vx1,t.vx2);
            if (!hitSeg && Math.abs(cy-t.vy)<4 && cx>=hMinX-4 && cx<=hMaxX+4) {
              hitSeg={w:we,type:'vy',turnIdx:ti,val:t.vy};
            }
          }
        }
      }
      if (hitSeg) {
        if (hitSeg.type === 'vy') {
          wireDrag.current = { wireId:hitSeg.w.id, type:'vy', turnIdx:hitSeg.turnIdx, startMouseY:sy, startVal:hitSeg.val };
        } else {
          wireDrag.current = { wireId:hitSeg.w.id, type:hitSeg.type, turnIdx:hitSeg.turnIdx, startMouseX:sx, startVal:hitSeg.val };
        }
        mouseDownPos.current = { x:cx, y:cy };
        return;
      }

            // Check if clicking a wire
      const w = findWire(cx, cy);
      if (w) {
        if (e.shiftKey) {
          const next = new Set(selWiresRef.current);
          next.has(w.id) ? next.delete(w.id) : next.add(w.id);
          setSW(next);
        } else if (e.ctrlKey || e.metaKey) {
          const next = new Set(selWiresRef.current);
          next.add(w.id);
          setSW(next);
        } else {
          setSW(new Set([w.id])); setSB(new Set()); setSelLocBoxes(new Set());
        }
        return;
      }

      // Check if clicking a block header area
      const clickedBlock = blocks.find(b => {
        const bb = blockBBox(b);
        return cx >= bb.x && cx <= bb.x+bb.w && cy >= bb.y && cy <= bb.y+HEADER_H;
      });
      if (clickedBlock) {
        if (e.shiftKey) {
          const next = new Set(selBlocksRef.current);
          next.has(clickedBlock.id) ? next.delete(clickedBlock.id) : next.add(clickedBlock.id);
          setSB(next);
        } else if (e.ctrlKey || e.metaKey) {
          const next = new Set(selBlocksRef.current);
          next.add(clickedBlock.id);
          setSB(next);
        } else {
          setSB(new Set([clickedBlock.id])); setSW(new Set()); setSelLocBoxes(new Set());
        }
        return;
      }

      // If annotation tool active, start drawing
      if (activeTool) {
        if (activeTool === "text") {
          const id = `a-${_annotId++}`;
          setAnnotations(as => [...as, { id, tool:"text", color:annotColor, x:snapG(cx), y:snapG(cy), text:"Note" }]);
          setEditingAnnot(id);
          setLastTool("text");
          setActiveTool(null);
          return;
        }
        annotDraw.current = { tool:activeTool, color:annotColor, x0:snapG(cx), y0:snapG(cy), x1:snapG(cx), y1:snapG(cy) };
        setAnnotDrawState({ ...annotDraw.current });
        return;
      }

      // Start marquee on empty space
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) { clearSel(); setSelAnnots(new Set()); }
      marqueeRef.current = { x1: cx, y1: cy, x2: cx, y2: cy, isAdditive: e.shiftKey || e.ctrlKey || e.metaKey };
      setMarquee({ x1: cx, y1: cy, x2: cx, y2: cy });
    }
  }, [pan, toCanvas, findPinAny, blocks, activeTool, annotColor]);

  const onCanvasMouseUp = useCallback((e) => {
    // Complete orphan drag-and-drop reconnect
    if (draggingOrphanRef.current) {
      const drag = draggingOrphanRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top  - pan.y) / zoom;
      const ow = orphanWires.find(o => o.id === drag.orphanId);
      if (ow) {
        const target = findPin(cx, cy);
        if (target) {
          const fromBlockId = ow.orphanEnd === 'from' ? target.blockId : ow.aliveBlockId;
          const fromPinId   = ow.orphanEnd === 'from' ? target.pinId   : ow.alivePinId;
          const toBlockId   = ow.orphanEnd === 'to'   ? target.blockId : ow.aliveBlockId;
          const toPinId     = ow.orphanEnd === 'to'   ? target.pinId   : ow.alivePinId;
          const pfx = ow.cableNum ? '' : (CABLE_PREFIX[ow.signal] || 9);
          const cableNum = ow.cableNum || `${pfx}${String(_cableIdx++).padStart(3,'0')}`;
          setWires(ws => [...ws, {
            id: `w-${_wireId++}`,
            fromBlockId, fromPinId, toBlockId, toPinId,
            feather: ow.feather,
            vx: null, vx2: null, turns: [],
            cableNum,
            signal: ow.signal,
            color: SIGNAL_COLORS[ow.signal] || '#888780',
          }]);
          setOrphanWires(os => os.filter(o => o.id !== drag.orphanId));
        }
      }
      draggingOrphanRef.current = null;
      setDraggingOrphan(null);
      setHoveredPin(null);
      return;
    }

    const wd2 = wireDrag.current;
    const wasDraggingBlocks = !!dragging.current;
    panning.current = null;
    dragging.current = null;
    wireDrag.current = null;
    locBoxDrag.current = null;
    const wasAnnotDrag = annotWasDragged.current;
    annotDrag.current = null;
    annotWasDragged.current = false;

    // Commit drawn annotation
    const ad2 = annotDraw.current;
    if (ad2) {
      annotDraw.current = null;
      setAnnotDrawState(null);
      const { tool, color, x0, y0, x1, y1 } = ad2;
      const minW = GRID * 2, minH = GRID * 2;
      if (Math.abs(x1-x0) >= minW || Math.abs(y1-y0) >= minH) {
        const id = `a-${_annotId++}`;
        const newA = { id, tool, color, x:Math.min(x0,x1), y:Math.min(y0,y1),
          x2:Math.max(x0,x1), y2:Math.max(y0,y1) };
        if (tool === "leader" || tool === "arrow") {
          Object.assign(newA, { x:x0, y:y0, x2:x1, y2:y1, text: tool==="leader" ? "Label" : "" });
        }
        if (tool === "dimension") { Object.assign(newA, { x:x0, y:y0, x2:x1, y2:y1, text:"" }); }
        setAnnotations(as => [...as, newA]);
        if (tool === "leader" || tool === "dimension") setEditingAnnot(id);
      }
      setLastTool(tool);
      setActiveTool(null);
    }

    // Auto-assign location when blocks finish moving
    if (wasDraggingBlocks) {
      setBlocks(bs => bs.map(b => {
        const cx = b.x + (PAD_W + BODY_W / 2);
        const cy = b.y + (HEADER_H / 2);
        // Find all containing boxes, pick smallest
        const containing = locBoxes.filter(lb =>
          cx >= lb.x && cx <= lb.x + lb.w && cy >= lb.y && cy <= lb.y + lb.h
        );
        if (containing.length === 0) return b; // keep last location
        const smallest = containing.reduce((a, c) => (c.w * c.h < a.w * a.h ? c : a));
        return { ...b, location: smallest.label };
      }));
    }

    // No sorting on mouseUp — user controls segment positions freely

    // Complete feather drag
    const curFeatherUp = featherDrawingRef.current;
    if (curFeatherUp && e.button === 2) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: cx, y: cy } = toCanvas(sx, sy);
      const wasDrag = mouseDownPos.current &&
        (Math.abs(cx - mouseDownPos.current.x) > 5 / zoom ||
         Math.abs(cy - mouseDownPos.current.y) > 5 / zoom);
      if (wasDrag) {
        const target = findPin(cx, cy, curFeatherUp.fromBlockId, curFeatherUp.fromPinId);
        if (target) {
          const srcBlock = blocks.find(b => b.id === curFeatherUp.fromBlockId);
          const tgtBlock = blocks.find(b => b.id === target.blockId);
          const allSrc = expandGroups(srcBlock?.eq.groups || []);
          const allTgt = expandGroups(tgtBlock?.eq.groups || []);
          const sp = allSrc.find(p => p.id === curFeatherUp.fromPinId);
          const tp = allTgt.find(p => p.id === target.pinId);
          const color = SIGNAL_COLORS[sp?.signal] || "#888";
          const mismatch = sp && tp && sp.signal !== tp.signal;
          const cableNum = `${CABLE_PREFIX[sp?.signal]||9}${String(_cableIdx++).padStart(3,"0")}`;
          const fpU = srcBlock ? getPinPositions(srcBlock)[curFeatherUp.fromPinId] : null;
          const tpU = tgtBlock ? getPinPositions(tgtBlock)[target.pinId] : null;
          const initVxU = smartVx(fpU, tpU);
          setWires(ws => [...ws, {
            id: `w-${_wireId++}`,
            fromBlockId: curFeatherUp.fromBlockId, fromPinId: curFeatherUp.fromPinId,
            toBlockId: target.blockId, toPinId: target.pinId,
            color: mismatch ? "#E24B4A" : color,
            dashed: mismatch, cableNum,
            signal: sp?.signal || "Other",
            vx: null, vx2: null, feather: true,
          }]);
          setFeatherDrawing(null);
          setHoveredPin(null);
        } else {
          // Drag ended on empty space — keep click mode active
        }
      }
      // If not drag, keep featherDrawing active for click-to-connect
      return;
    }

    const currentDrawing = drawingRef.current;
    if (currentDrawing) {
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: cx, y: cy } = toCanvas(sx, sy);

      const wasDrag = mouseDownPos.current &&
        (Math.abs(cx - mouseDownPos.current.x) > 5 / zoom ||
         Math.abs(cy - mouseDownPos.current.y) > 5 / zoom);
      mouseDownPos.current = null;

      if (!wasDrag) {
        return;
      }

      const target = findPin(cx, cy, currentDrawing.fromBlockId, currentDrawing.fromPinId);
      if (target) {
        const srcBlock = blocks.find(b => b.id === currentDrawing.fromBlockId);
        const tgtBlock = blocks.find(b => b.id === target.blockId);
        const allSrcPins = expandGroups(srcBlock?.eq.groups || []);
        const allTgtPins = expandGroups(tgtBlock?.eq.groups || []);
        const sp = allSrcPins.find(p => p.id === currentDrawing.fromPinId);
        const tp = allTgtPins.find(p => p.id === target.pinId);
        const color = SIGNAL_COLORS[sp?.signal] || "#888";
        const mismatch = sp && tp && sp.signal !== tp.signal;
        const cableNum = `${CABLE_PREFIX[sp?.signal]||9}${String(_cableIdx++).padStart(3,"0")}`;
        const fb3 = blocks.find(b => b.id === currentDrawing.fromBlockId);
        const tb3 = blocks.find(b => b.id === target.blockId);
        const fp3 = fb3 ? getPinPositions(fb3)[currentDrawing.fromPinId] : null;
        const tp3 = tb3 ? getPinPositions(tb3)[target.pinId] : null;
        const initVx2 = smartVx(fp3, tp3);
        setWires(ws => [...ws, {
          id: `w-${_wireId++}`,
          fromBlockId: currentDrawing.fromBlockId, fromPinId: currentDrawing.fromPinId,
          toBlockId: target.blockId, toPinId: target.pinId,
          color: mismatch ? "#E24B4A" : color,
          dashed: mismatch, cableNum,
          signal: sp?.signal || "Other",
          vx: initVx2,
        }]);
      }
      setDrawing(null);
      setHoveredPin(null);
    }

    // Finalize marquee
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      const x1 = Math.min(m.x1, m.x2), x2 = Math.max(m.x1, m.x2);
      const y1 = Math.min(m.y1, m.y2), y2 = Math.max(m.y1, m.y2);
      const isWindow = m.x2 >= m.x1; // left→right = window, right→left = crossing
      const newBlocks = new Set(m.isAdditive ? selBlocksRef.current : new Set());
      const newWires  = new Set(m.isAdditive ? selWiresRef.current  : new Set());

      blocks.forEach(b => {
        const bb = blockBBox(b);
        const inside   = bb.x >= x1 && bb.x+bb.w <= x2 && bb.y >= y1 && bb.y+bb.h <= y2;
        const crossing = !(bb.x > x2 || bb.x+bb.w < x1 || bb.y > y2 || bb.y+bb.h < y1);
        if (isWindow ? inside : crossing) newBlocks.add(b.id);
      });
      wireEndpointsRef.current.forEach(w => {
        let wxMin, wxMax, wyMin, wyMax;
        if (w.feather) {
          // Feather bounding box: covers both tag tails and chevrons
          const TAIL_F = GRID * 3;
          const CHAR_W = 4.8; const PAD_F = 2; const ARR_F = 5;
          const srcBlock = blocks.find(b => b.id === w.fromBlockId);
          const tgtBlock = blocks.find(b => b.id === w.toBlockId);
          const srcIsLeft = srcBlock && (w.x1 < srcBlock.x + PAD_W);
          const dstIsLeft = tgtBlock && (w.x2 < tgtBlock.x + PAD_W);
          const srcBodyText = pinLabel(tgtBlock, w.toPinId);
          const dstBodyText = pinLabel(srcBlock, w.fromPinId);
          const srcBW = Math.ceil(srcBodyText.length * CHAR_W) + PAD_F * 2 + ARR_F;
          const dstBW = Math.ceil(dstBodyText.length * CHAR_W) + PAD_F * 2 + ARR_F;
          // Source extents
          const srcOffset = w.vx != null ? w.vx : (srcIsLeft ? -TAIL_F : TAIL_F);
          const srcVx = w.x1 + srcOffset;
          const hasSrcTurn = w.srcVy != null;
          const srcVx2Off = w.srcVx2 != null ? w.srcVx2 : TAIL_F;
          const srcGoRight = !srcIsLeft;
          const srcChevFlatX = hasSrcTurn
            ? srcVx + (srcGoRight ? srcVx2Off : -srcVx2Off)
            : srcVx;
          const srcTipX = srcGoRight ? srcChevFlatX + srcBW : srcChevFlatX - srcBW;
          const srcBentY = hasSrcTurn ? w.y1 + w.srcVy : w.y1;
          // Dest extents
          const dstOffset = w.vx2 != null ? w.vx2 : (dstIsLeft ? -TAIL_F : TAIL_F);
          const dstVx = w.x2 + dstOffset;
          const hasDstTurn = w.dstVy != null;
          const dstVx2Off = w.dstVx2 != null ? w.dstVx2 : TAIL_F;
          const dstGoRight = dstIsLeft;
          const dstChevTipX = hasDstTurn
            ? dstVx + (dstGoRight ? -dstVx2Off : dstVx2Off)
            : dstVx;
          const dstChevFlatX = dstGoRight ? dstChevTipX - dstBW : dstChevTipX + dstBW;
          const dstBentY = hasDstTurn ? w.y2 + w.dstVy : w.y2;
          // Combined bounding box of both tags
          const allX = [w.x1, srcVx, srcChevFlatX, srcTipX, w.x2, dstVx, dstChevTipX, dstChevFlatX];
          const allY = [w.y1, srcBentY, w.y2, dstBentY];
          wxMin = Math.min(...allX); wxMax = Math.max(...allX);
          wyMin = Math.min(...allY); wyMax = Math.max(...allY);
        } else {
          // Regular wire: window = bounding box, crossing = per-segment
          // (bounding box crossing is too coarse for L/Z shapes — selects neighbours)
          const vx = w.vx != null ? w.vx : defaultVx(w.x1, w.x2);
          const pts = buildWaypoints(w.x1, w.y1, w.x2, w.y2, vx, w.turns || []);
          const wxMin2 = Math.min(...pts.map(p => p.x));
          const wxMax2 = Math.max(...pts.map(p => p.x));
          const wyMin2 = Math.min(...pts.map(p => p.y));
          const wyMax2 = Math.max(...pts.map(p => p.y));
          const wInside = wxMin2 >= x1 && wxMax2 <= x2 && wyMin2 >= y1 && wyMax2 <= y2;
          const wCrossing = pts.slice(1).some((p1, i) => {
            const p0 = pts[i];
            if (p0.y === p1.y) {
              const sxMin = Math.min(p0.x, p1.x), sxMax = Math.max(p0.x, p1.x);
              return p0.y >= y1 && p0.y <= y2 && sxMin <= x2 && sxMax >= x1;
            } else {
              const syMin = Math.min(p0.y, p1.y), syMax = Math.max(p0.y, p1.y);
              return p0.x >= x1 && p0.x <= x2 && syMin <= y2 && syMax >= y1;
            }
          });
          if (isWindow ? wInside : wCrossing) newWires.add(w.id);
          return; // forEach — skip feather bbox path below
        }
        const inside   = wxMin >= x1 && wxMax <= x2 && wyMin >= y1 && wyMax <= y2;
        const crossing = !(wxMin > x2 || wxMax < x1 || wyMin > y2 || wyMax < y1);
        if (isWindow ? inside : crossing) newWires.add(w.id);
      });
      // Select annotations inside marquee (supports multiple)
      const newAnnots = m.isAdditive ? new Set(selAnnotsRef.current) : new Set();
      annotations.forEach(a => {
        const ax = a.x2 != null ? Math.min(a.x, a.x2) : a.x;
        const ay = a.y2 != null ? Math.min(a.y, a.y2) : a.y;
        const aw = a.x2 != null ? Math.abs(a.x2 - a.x) : 60;
        const ah = a.y2 != null ? Math.abs(a.y2 - a.y) : 20;
        const inside   = ax >= x1 && ax+aw <= x2 && ay >= y1 && ay+ah <= y2;
        const crossing = !(ax > x2 || ax+aw < x1 || ay > y2 || ay+ah < y1);
        if (isWindow ? inside : crossing) newAnnots.add(a.id);
      });
      // Spare runs in marquee — use anchor dot positions as bbox
      spares.forEach(sp => {
        const fromLb = locBoxes.find(lb => lb.id === sp.fromLocBoxId);
        const toLb   = locBoxes.find(lb => lb.id === sp.toLocBoxId);
        if (!fromLb || !toLb) return;
        const sx1 = fromLb.x + fromLb.w, sy1 = fromLb.y + sp.fromEdgeY;
        const sx2 = toLb.x,              sy2 = toLb.y + sp.toEdgeY;
        const vx = sp.vx != null ? sp.vx : snapG((sx1+sx2)/2);
        const pts = buildWaypoints(sx1, sy1, sx2, sy2, vx, sp.turns || []);
        const wxMin = Math.min(...pts.map(p=>p.x));
        const wxMax = Math.max(...pts.map(p=>p.x));
        const wyMin = Math.min(...pts.map(p=>p.y));
        const wyMax = Math.max(...pts.map(p=>p.y));
        const inside   = wxMin >= x1 && wxMax <= x2 && wyMin >= y1 && wyMax <= y2;
        const crossing = !(wxMin > x2 || wxMax < x1 || wyMin > y2 || wyMax < y1);
        if (isWindow ? inside : crossing) newWires.add(sp.id);
      });
      setSelAnnots(newAnnots);
      // Loc boxes in marquee
      const newLocBoxes = m.isAdditive ? new Set(selLocBoxesRef.current) : new Set();
      locBoxes.forEach(lb => {
        const inside   = lb.x >= x1 && lb.x+lb.w <= x2 && lb.y >= y1 && lb.y+lb.h <= y2;
        const crossing = !(lb.x > x2 || lb.x+lb.w < x1 || lb.y > y2 || lb.y+lb.h < y1);
        if (isWindow ? inside : crossing) newLocBoxes.add(lb.id);
      });
      setSelLocBoxes(newLocBoxes);
      setSB(newBlocks); setSW(newWires);
    }
  }, [toCanvas, findPin, blocks, zoom, annotations]);

  // Scroll to zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.2, zoom * delta));
    // Zoom toward cursor
    setPan(p => ({
      x: sx - (sx - p.x) * (newZoom / zoom),
      y: sy - (sy - p.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  }, [zoom]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Block header drag
  const onHeaderMouseDown = useCallback((e, blockId) => {
    if (drawingRef.current) return;
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const block = blocks.find(b => b.id === blockId);

    // Shift = toggle, Ctrl = add, plain = set
    if (e.shiftKey) {
      const next = new Set(selBlocksRef.current);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      setSB(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selBlocksRef.current);
      next.add(blockId);
      setSB(next);
    } else {
      if (!selBlocksRef.current.has(blockId)) { setSB(new Set([blockId])); setSW(new Set()); }
    }

    // Drag all selected items together (blocks + annotations + loc boxes + wires)
    const selectedIds = selBlocksRef.current.has(blockId) ? selBlocksRef.current : new Set([blockId]);
    const startPositions = {};
    blocks.forEach(b => { if (selectedIds.has(b.id)) startPositions[b.id] = { x: b.x, y: b.y }; });
    // Capture wire vx start positions for wires where BOTH ends are selected
    const startWireVx = {};
    wires.forEach(w => {
      if (selectedIds.has(w.fromBlockId) && selectedIds.has(w.toBlockId)) {
        startWireVx[w.id] = {
          vx: w.vx,
          turns: w.turns ? w.turns.map(t => ({ ...t })) : [],
        };
      }
    });
    // Capture annotation start positions
    const startAnnotPositions = {};
    const selAnnotIds = selAnnotsRef.current;
    // Capture loc box start positions
    const startLocBoxPositions = {};
    const selLbIds = selLocBoxesRef.current;
    dragging.current = {
      blockId, multiIds: selectedIds,
      startMouseX: e.clientX - rect.left,
      startMouseY: e.clientY - rect.top,
      startPositions, startWireVx,
      selAnnotIds, startAnnotPositions,
      selLbIds, startLocBoxPositions,
    };
  }, [blocks]);

  // Drop from sidebar
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const json = e.dataTransfer.getData("application/avflow");
    if (!json) return;
    const eq = JSON.parse(json);
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = toCanvas(sx, sy);

    // Auto-assign system name using lowest available number for this prefix
    const prefix = getPrefix(eq.systemName);
    let assignedName = eq.systemName || "";
    // Compute drop position and which location box it lands in
    const bx = snap(x - PAD_W - BODY_W/2);
    const by = snap(y - HEADER_H/2);
    const bcx = bx + PAD_W + BODY_W / 2;  // block center x
    const bcy = by + HEADER_H / 2;         // block center y
    const containing = locBoxes.filter(lb =>
      bcx >= lb.x && bcx <= lb.x + lb.w && bcy >= lb.y && bcy <= lb.y + lb.h
    );
    const dropLocation = containing.length > 0
      ? containing.reduce((a, c) => c.w * c.h < a.w * a.h ? c : a).label
      : eq.location;

    if (prefix) {
      setBlocks(bs => {
        const usedNames = bs.map(b => b.systemName);
        assignedName = getNextSysName(prefix, usedNames);
        return [...bs, {
          id: `b-${_blockId++}`, eq,
          x: bx, y: by,
          systemName: assignedName,
          location: dropLocation,
        }];
      });
    } else {
      setBlocks(bs => [...bs, {
        id: `b-${_blockId++}`, eq,
        x: bx, y: by,
        systemName: eq.systemName || "",
        location: dropLocation,
      }]);
    }
  }, [toCanvas, locBoxes]);

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onLibDragStart = (e, eq) => { e.dataTransfer.setData("application/avflow", JSON.stringify(eq)); };

  // Delete selected block + its wires
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Delete everything selected in one pass — no early returns
        const sb  = selBlocksRef.current;
        const sw  = selWiresRef.current;
        const sa  = selAnnotsRef.current;
        const slb = selLocBoxesRef.current;
        const hasAny = sb.size > 0 || sw.size > 0 || sa.size > 0 || slb.size > 0;
        if (hasAny) {
          if (sa.size > 0)  { setAnnotations(as => as.filter(a => !sa.has(a.id))); }
          if (slb.size > 0) { setLocBoxes(lbs => lbs.filter(lb => !slb.has(lb.id))); }
          if (sw.size > 0)  { setSpares(ss => ss.filter(s => !sw.has(s.id))); }
          if (sb.size > 0 || sw.size > 0) {
            setWires(ws => ws.filter(w => !sw.has(w.id) && !sb.has(w.fromBlockId) && !sb.has(w.toBlockId)));
            setBlocks(bs => bs.filter(b => !sb.has(b.id)));
          }
          clearSel();
        }
      }
      if (e.key === "Escape") {
        setDrawing(null); setFeatherDrawing(null); setHoveredPin(null);
        setActiveTool(null); annotDraw.current = null; setAnnotDrawState(null);
        setSelAnnots(new Set()); setEditingAnnot(null);
        clearSel(); setContextMenu(null);
        marqueeRef.current = null; setMarquee(null);
        draggingOrphanRef.current = null; setDraggingOrphan(null); setSwapModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cursor style
  const getCursor = () => {
    if (draggingOrphan || draggingOrphanRef.current) return "crosshair";
    if (panning.current) return "grabbing";
    if (spareDrawing) return "crosshair";
    if (wireDrag.current?.type === 'vy') return "ns-resize";
    if (wireDrag.current) return "ew-resize"; // covers vx, vx1, vx2, feather_src_vx, feather_dst_vx
    if (featherDrawingRef.current) return "cell";
    if (drawingRef.current) return "crosshair";
    if (hoveredPin) return "crosshair";
    if (marqueeRef.current) return "crosshair";
    if (activeTool) return ANNOT_TOOLS.find(t=>t.id===activeTool)?.cursor || "crosshair";
    return "default";
  };



  // Build wire endpoints from current block positions
  const wireEndpointsRef = useRef([]);
  // ── Equipment swap ────────────────────────────────────────────────────────
  const doSwap = (oldBlockId, newEq) => {
    const oldBlock = blocks.find(b => b.id === oldBlockId);
    if (!oldBlock) return;

    // Location from containing locBox
    const bcx = oldBlock.x + PAD_W + BODY_W / 2;
    const bcy = oldBlock.y + HEADER_H / 2;
    const containing = locBoxes.filter(lb =>
      bcx >= lb.x && bcx <= lb.x + lb.w && bcy >= lb.y && bcy <= lb.y + lb.h
    );
    const newLocation = containing.length > 0
      ? containing.reduce((a, c) => c.w * c.h < a.w * a.h ? c : a).label
      : oldBlock.location;

    const newBlockId = `b-${_blockId++}`;
    const blockTotalW = PAD_W + BODY_W + PAD_W;
    const blockCx = oldBlock.x + blockTotalW / 2;

    const connected = wires.filter(w =>
      w.fromBlockId === oldBlockId || w.toBlockId === oldBlockId
    );

    const newOrphans = connected.map(w => {
      const orphanEnd    = w.fromBlockId === oldBlockId ? 'from' : 'to';
      const orphanPinId  = orphanEnd === 'from' ? w.fromPinId  : w.toPinId;
      const aliveBlockId = orphanEnd === 'from' ? w.toBlockId  : w.fromBlockId;
      const alivePinId   = orphanEnd === 'from' ? w.toPinId    : w.fromPinId;

      const oldPins = getPinPositions(oldBlock);
      const pp = oldPins[orphanPinId];
      const goRight = !pp || pp.x >= blockCx;
      const floatCanvasX = pp
        ? pp.x + (goRight ? 50 : -50)
        : oldBlock.x + (goRight ? blockTotalW + 50 : -50);
      const floatCanvasY = pp ? pp.y : oldBlock.y + HEADER_H;

      const expanded = expandGroups(oldBlock.eq?.groups || []);
      const pinData  = expanded.find(p => p.id === orphanPinId);
      const signal   = pinData?.signal || 'Other';

      const aliveBlock = blocks.find(b => b.id === aliveBlockId);
      return {
        id: `orphan-${w.id}`,
        signal,
        feather: !!w.feather,
        orphanEnd,
        aliveBlockId,
        alivePinId,
        floatCanvasX,
        floatCanvasY,
        originalBlockLabel: oldBlock.systemName || oldBlock.eq?.model || '?',
        originalPinLabel:   pinData?.description || orphanPinId,
        aliveBlockLabel:    aliveBlock ? (aliveBlock.systemName || aliveBlock.eq?.model || '?') : '?',
        cableNum: w.cableNum,
        vx: w.vx,
        turns: w.turns || [],
      };
    });

    setBlocks(bs => [
      ...bs.filter(b => b.id !== oldBlockId),
      { id: newBlockId, eq: newEq, x: oldBlock.x, y: oldBlock.y,
        systemName: oldBlock.systemName, location: newLocation,
        ipInfo: oldBlock.ipInfo || {} },
    ]);
    setWires(ws => ws.filter(w => !connected.some(c => c.id === w.id)));
    setOrphanWires(os => [...os, ...newOrphans]);
    setSwapModal(null);
    setSwapSearch('');
    setSwapCat('All');
    setSwapMfr('All');
  };

  const wireEndpoints = wires.map(w => {
    const fb = blocks.find(b => b.id === w.fromBlockId);
    const tb = blocks.find(b => b.id === w.toBlockId);
    if (!fb || !tb) return null;
    const fp = getPinPositions(fb)[w.fromPinId];
    const tp = getPinPositions(tb)[w.toPinId];
    if (!fp || !tp) return null;
    const base = { ...w, x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y };
    return normalizeWire(base, fp.x, tp.x);
  }).filter(Boolean);
  wireEndpointsRef.current = wireEndpoints;

  // Pre-compute all horizontal segments from all wires (regular + feather tails).
  // Used by the vertical-segments pass to detect crossings and insert arcs.
  const allHSegs = [
    // ── Regular wire H segments ──────────────────────────────────────────
    ...wireEndpoints.filter(w => !w.feather).flatMap(w => {
      const vx_    = w.vx != null ? w.vx : defaultVx(w.x1, w.x2);
      const turns_ = w.turns || [];
      const pts_   = buildWaypoints(w.x1, w.y1, w.x2, w.y2, vx_, turns_);
      const segs   = [];
      for (let i = 0; i < pts_.length - 1; i++) {
        const p0 = pts_[i], p1 = pts_[i + 1];
        if (p0.y === p1.y)
          segs.push({ x1: Math.min(p0.x, p1.x), x2: Math.max(p0.x, p1.x), y: p0.y, wireId: w.id });
      }
      return segs;
    }),
    // ── Feather tail H segments ──────────────────────────────────────────
    ...wireEndpoints.filter(w => w.feather).flatMap(w => {
      const FTAIL     = GRID * 3;
      const sx0 = w.x1, sy = w.y1, dx0 = w.x2, dy = w.y2;
      const srcBlock  = blocks.find(b => b.id === w.fromBlockId);
      const tgtBlock  = blocks.find(b => b.id === w.toBlockId);
      const srcIsLeft = srcBlock && (w.x1 < srcBlock.x + PAD_W);
      const dstIsLeft = tgtBlock && (w.x2 < tgtBlock.x + PAD_W);
      const srcGoRight = !srcIsLeft;
      const dstGoRight = dstIsLeft;
      const srcVx = sx0 + (w.vx  != null ? w.vx  : (srcIsLeft ? -FTAIL : FTAIL));
      const dstVx = dx0 + (w.vx2 != null ? w.vx2 : (dstIsLeft ? -FTAIL : FTAIL));
      const hasSrcTurn  = w.srcVy  != null;
      const hasDstTurn  = w.dstVy  != null;
      const srcBentY    = hasSrcTurn ? sy + w.srcVy : sy;
      const dstBentY    = hasDstTurn ? dy + w.dstVy : dy;
      const srcVx2      = srcVx + (srcGoRight ?  (w.srcVx2 ?? FTAIL) : -(w.srcVx2 ?? FTAIL));
      const dstVx2      = dstVx + (dstGoRight ? -(w.dstVx2 ?? FTAIL) :  (w.dstVx2 ?? FTAIL));
      const srcChevFlatX = hasSrcTurn ? srcVx2 : srcVx;
      const dstChevTipX  = hasDstTurn ? dstVx2 : dstVx;
      const segs = [];
      if (hasSrcTurn) {
        segs.push({ x1: Math.min(sx0, srcVx),        x2: Math.max(sx0, srcVx),        y: sy,       wireId: w.id });
        segs.push({ x1: Math.min(srcVx, srcChevFlatX), x2: Math.max(srcVx, srcChevFlatX), y: srcBentY, wireId: w.id });
      } else {
        segs.push({ x1: Math.min(sx0, srcChevFlatX), x2: Math.max(sx0, srcChevFlatX), y: sy, wireId: w.id });
      }
      if (hasDstTurn) {
        segs.push({ x1: Math.min(dx0, dstVx),        x2: Math.max(dx0, dstVx),        y: dy,       wireId: w.id });
        segs.push({ x1: Math.min(dstVx, dstChevTipX), x2: Math.max(dstVx, dstChevTipX), y: dstBentY, wireId: w.id });
      } else {
        segs.push({ x1: Math.min(dx0, dstChevTipX), x2: Math.max(dx0, dstChevTipX), y: dy, wireId: w.id });
      }
      return segs;
    }),
  ];

  return (
    <div style={{ display:"flex", height:"100vh", background:"#0f1117", fontFamily:"system-ui,sans-serif", overflow:"hidden" }}>
      <style>{`@keyframes orphan-pulse { 0%,100%{opacity:0.5;r:13} 50%{opacity:0.15;r:18} }`}</style>

      {/* ── Sidebar ── */}
      <Sidebar blocks={blocks} onDragStart={onLibDragStart} />

      {/* ── Canvas ── */}
      <div ref={canvasRef}
        style={{ flex:1, position:"relative", overflow:"hidden",
          cursor: getCursor() }}
        onMouseMove={onCanvasMouseMove}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={() => { panning.current = null; dragging.current = null; if (drawing) { setDrawing(null); setHoveredPin(null); } }}
        onContextMenu={e => {
          e.preventDefault();
          if (featherDrawingRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const { x: cx, y: cy } = toCanvas(e.clientX - rect.left, e.clientY - rect.top);
          const w = findWire(cx, cy);
          if (w) { setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, wireId: w.id }); return; }
          // Show canvas context menu for empty space or loc box
          // Check if near a loc box edge (for spare run creation)
          let nearLocBoxId = null, nearEdgeY = 0;
          for (const lb of locBoxes) {
            const edgeTol = 12;
            if (Math.abs(cx - (lb.x + lb.w)) < edgeTol && cy >= lb.y && cy <= lb.y + lb.h) {
              nearLocBoxId = lb.id; nearEdgeY = snapG(cy - lb.y); break;
            }
            if (Math.abs(cx - lb.x) < edgeTol && cy >= lb.y && cy <= lb.y + lb.h) {
              nearLocBoxId = lb.id; nearEdgeY = snapG(cy - lb.y); break;
            }
          }
          // If spare drawing active + clicked a different loc box edge → complete
          if (spareDrawing && nearLocBoxId && nearLocBoxId !== spareDrawing.fromLocBoxId) {
            const sig = spareDrawing.signal || Object.keys(SIGNAL_COLORS)[0];
            const color = SIGNAL_COLORS[sig] || "#888780";
            const pfx = CABLE_PREFIX[sig] || 9;
            const cableNum = `${pfx}S${String(_spareCableIdx++).padStart(2,"0")}`;
            setSpares(ss => [...ss, {
              id: `sp-${_spareId++}`,
              fromLocBoxId: spareDrawing.fromLocBoxId,
              fromEdgeY: spareDrawing.fromEdgeY,
              toLocBoxId: nearLocBoxId,
              toEdgeY: nearEdgeY,
              signal: sig, color,
              qty: spareDrawing.qty || "1",
              length: spareDrawing.length || "",
              cableNum, vx: null, turns: [],
            }]);
            setSpareDrawing(null);
            return;
          }
          if (spareDrawing && !nearLocBoxId) { setSpareDrawing(null); }
          setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top,
            canvasX: cx, canvasY: cy, nearLocBoxId, nearEdgeY });
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {/* Grid */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
          <defs>
            <pattern id="grid" width={GRID*zoom} height={GRID*zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (GRID*zoom)} y={pan.y % (GRID*zoom)}>
              <path d={`M ${GRID*zoom} 0 L 0 0 0 ${GRID*zoom}`}
                fill="none" stroke="#1a1f2e" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Transformed world */}
        <div style={{ position:"absolute", left:pan.x, top:pan.y,
          transform:`scale(${zoom})`, transformOrigin:"0 0" }}>

          {/* Location boxes — rendered below everything */}
          {locBoxes.map(lb => {
            const isSel = selLocBoxesRef.current.has(lb.id);
            const isEditing = editingLocBox === lb.id;
            const E = 8;
            const bdrColor = isSel ? "#388bfd" : "#4a5568";

            const startDrag = (ev, type, edge) => {
              ev.preventDefault();
              ev.stopPropagation();
              const r = canvasRef.current.getBoundingClientRect();
              // Update selection based on modifier keys
              if (ev.shiftKey) {
                // Shift = remove from selection
                const next = new Set(selLocBoxesRef.current);
                next.delete(lb.id);
                setSelLocBoxes(next);
              } else if (ev.ctrlKey || ev.metaKey) {
                // Ctrl = add to selection
                const next = new Set(selLocBoxesRef.current);
                next.add(lb.id);
                setSelLocBoxes(next);
              } else {
                // Plain click = exclusive select (unless already in selection — allow drag)
                if (!selLocBoxesRef.current.has(lb.id)) {
                  setSelLocBoxes(new Set([lb.id]));
                  setSB(new Set()); setSW(new Set()); setSelAnnots(new Set());
                }
              }
              if (type === 'move' || edge) {
                // Capture start positions for ALL currently selected loc boxes
                const selIds = selLocBoxesRef.current.has(lb.id)
                  ? selLocBoxesRef.current
                  : new Set([lb.id]);
                const startBoxes = {};
                // We'll capture in mouseDown using current locBoxes state
                // Capture wire vx for wires where both block ends are selected
                const lbStartWireVx = {};
                const lbSelBlocks = selBlocksRef.current;
                wires.forEach(w => {
                  if (lbSelBlocks.has(w.fromBlockId) && lbSelBlocks.has(w.toBlockId)) {
                    lbStartWireVx[w.id] = {
                      vx: w.vx,
                      turns: w.turns ? w.turns.map(t => ({ ...t })) : [],
                    };
                  }
                });
                locBoxDrag.current = {
                  id: lb.id, type, edge: edge || "",
                  startX: ev.clientX - r.left, startY: ev.clientY - r.top,
                  startBox: { ...lb }, selIds,
                  selBlockIds: selBlocksRef.current,
                  startBlockPositions: {},
                  selAnnotIds: selAnnotsRef.current,
                  startAnnotPositions: {},
                  startBoxes: {},
                  startWireVx: lbStartWireVx,
                };
              }
            };

            return (
              <div key={lb.id}
                style={{
                  position:"absolute", left:lb.x, top:lb.y,
                  width:lb.w, height:lb.h,
                  pointerEvents:"none", zIndex:1
                }}
>
                {/* Dashed border — purely visual, no pointer events */}
                <div style={{
                  position:"absolute", inset:0,
                  border:`1px dashed ${bdrColor}`,
                  background: isSel ? "rgba(56,139,253,0.03)" : "transparent",
                  pointerEvents:"none", boxSizing:"border-box"
                }}/>

                {/* Label — top-left, pointer events only on the text itself */}
                {isEditing ? (
                  <input
                    key={lb.id + "-edit"}
                    autoFocus
                    defaultValue={lb.label}
                    onBlur={ev => {
                      const newLabel = ev.target.value;
                      // Update the box label
                      setLocBoxes(lbs => lbs.map(l => l.id===lb.id ? {...l, label:newLabel} : l));
                      // Reassign location on all blocks contained within this box
                      setBlocks(bs => bs.map(b => {
                        const cx = b.x + PAD_W + BODY_W / 2;
                        const cy = b.y + HEADER_H / 2;
                        if (cx >= lb.x && cx <= lb.x + lb.w && cy >= lb.y && cy <= lb.y + lb.h) {
                          return { ...b, location: newLabel };
                        }
                        return b;
                      }));
                      setEditingLocBox(null);
                    }}
                    onKeyDown={ev => {
                      if (ev.key==="Enter") ev.target.blur();
                      if (ev.key==="Escape") { setEditingLocBox(null); }
                      ev.stopPropagation();
                    }}
                    style={{
                      position:"absolute", left:8, top:6,
                      fontSize:33, fontWeight:700,
                      background:"transparent", border:"none",
                      outline:"1px solid #388bfd",
                      color:"#c8d0e8", padding:0,
                      pointerEvents:"all", zIndex:5,
                      width:Math.min(lb.w-20, 400),
                      fontFamily:"system-ui,sans-serif", lineHeight:1
                    }}
                  />
                ) : (
                  <div
                    onDoubleClick={ev => { ev.stopPropagation(); setEditingLocBox(lb.id); }}
                    onMouseDown={ev => { ev.stopPropagation(); startDrag(ev, "move"); }}
                    style={{
                      position:"absolute", left:8, top:6,
                      fontSize:33, fontWeight:700,
                      color: isSel ? "#388bfd" : "#4a5568",
                      userSelect:"none", cursor:"move",
                      lineHeight:1, zIndex:5,
                      pointerEvents:"all", whiteSpace:"nowrap",
                      maxWidth: lb.w - 20, overflow:"hidden"
                    }}>
                    {lb.label}
                  </div>
                )}

                {/* Move strip — top GRID*3 height, but BEHIND the label (label handles its own drag) */}
                <div
                  style={{
                    position:"absolute", left:0, top:0,
                    width:"100%", height:GRID*3,
                    cursor:"move", pointerEvents:"all", zIndex:2
                  }}
                  onMouseDown={ev => startDrag(ev, "move")}
                />

                {/* Resize edges — only shown/active when selected */}
                {isSel && <>
                  <div style={{position:"absolute",left:E,top:-E/2,right:E,height:E,cursor:"ns-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","t")}/>
                  <div style={{position:"absolute",left:E,bottom:-E/2,right:E,height:E,cursor:"ns-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","b")}/>
                  <div style={{position:"absolute",top:E,left:-E/2,bottom:E,width:E,cursor:"ew-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","l")}/>
                  <div style={{position:"absolute",top:E,right:-E/2,bottom:E,width:E,cursor:"ew-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","r")}/>
                  <div style={{position:"absolute",top:-E/2,left:-E/2,width:E*2,height:E*2,cursor:"nwse-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","tl")}/>
                  <div style={{position:"absolute",top:-E/2,right:-E/2,width:E*2,height:E*2,cursor:"nesw-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","tr")}/>
                  <div style={{position:"absolute",bottom:-E/2,left:-E/2,width:E*2,height:E*2,cursor:"nesw-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","bl")}/>
                  <div style={{position:"absolute",bottom:-E/2,right:-E/2,width:E*2,height:E*2,cursor:"nwse-resize",pointerEvents:"all",zIndex:4}} onMouseDown={ev=>startDrag(ev,"edge","br")}/>
                </>}
              </div>
            );
          })}

          {/* Spare cable runs */}
          <svg style={{ position:"absolute", overflow:"visible", pointerEvents:"all",
            left:0, top:0, width:1, height:1, zIndex:5 }}>
            {spares.map(sp => {
              const fromLb = locBoxes.find(lb => lb.id === sp.fromLocBoxId);
              const toLb   = locBoxes.find(lb => lb.id === sp.toLocBoxId);
              if (!fromLb || !toLb) return null;
              const isSel = selWires.has(sp.id);
              const color = SIGNAL_COLORS[sp.signal] || "#888780";
              const stroke = isSel ? "#fff" : color;
              // Anchor dots: right edge of fromLb, left edge of toLb (or swap if reversed)
              const x1 = fromLb.x + fromLb.w;
              const y1 = fromLb.y + sp.fromEdgeY;
              const x2 = toLb.x;
              const y2 = toLb.y + sp.toEdgeY;
              const vx = sp.vx != null ? sp.vx : snapG((x1+x2)/2);
              const turns = sp.turns || [];
              const pts = buildWaypoints(x1, y1, x2, y2, vx, turns);
              const path = buildPath(pts);
              // Badge on longest H segment
              const longestSeg = pts.slice(1).reduce((best, p1, i) => {
                const p0 = pts[i];
                if (p0.y === p1.y) {
                  const len = Math.abs(p1.x - p0.x);
                  return len > best.len ? { x: (p0.x+p1.x)/2, y: p0.y, len } : best;
                }
                return best;
              }, { x: (x1+x2)/2, y: y1, len: 0 });
              const bx = longestSeg.x, by = longestSeg.y;
              const line1 = `SPARE  ${sp.cableNum}`;
              const line2 = `×${sp.qty} ${sp.signal}${sp.length ? " · " + sp.length : ""}`;
              const bw = Math.max(line1.length, line2.length) * 5.5 + 16;

              return (
                <g key={sp.id}
                  style={{ pointerEvents:"none" }}
                  onClick={e => { e.stopPropagation(); setSW(new Set([sp.id])); setSB(new Set()); }}>
                  {/* Hit lines */}
                  {pts.slice(1).map((p1, i) => {
                    const p0 = pts[i];
                    return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
                      stroke="rgba(0,0,0,0)" strokeWidth={6}
                      style={{ pointerEvents:"stroke", cursor:"pointer" }}
                      onClick={e => { e.stopPropagation(); setSW(new Set([sp.id])); setSB(new Set()); }}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation();
                        const r = canvasRef.current.getBoundingClientRect();
                        setContextMenu({ x:e.clientX-r.left, y:e.clientY-r.top, wireId:sp.id, isSpare:true });
                      }} />;
                  })}
                  {/* Anchor dots */}
                  <circle cx={x1} cy={y1} r={4} fill={stroke} stroke="#1a1f2e" strokeWidth={2}/>
                  <circle cx={x2} cy={y2} r={4} fill={stroke} stroke="#1a1f2e" strokeWidth={2}/>
                  {/* Dashed path */}
                  <path d={path} fill="none" stroke={stroke} strokeWidth={isSel?2:1.5}
                    strokeDasharray="6 4" strokeLinejoin="round" style={{ pointerEvents:"none" }}/>
                  {/* Badge */}
                  <rect x={bx-bw/2} y={by-17} width={bw} height={28} rx={4}
                    fill={color+"18"} stroke={color} strokeWidth={0.5} strokeDasharray="3 2"
                    style={{ pointerEvents:"none" }}/>
                  <text x={bx} y={by-8} textAnchor="middle" dominantBaseline="central"
                    fontSize={8.5} fontWeight={600} fill={stroke}
                    style={{ fontFamily:"system-ui", pointerEvents:"none", userSelect:"none" }}>
                    {line1}
                  </text>
                  <text x={bx} y={by+7} textAnchor="middle" dominantBaseline="central"
                    fontSize={8} fill={stroke}
                    style={{ fontFamily:"monospace", pointerEvents:"none", userSelect:"none" }}>
                    {line2}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Wires SVG */}
          <svg style={{ position:"absolute", overflow:"visible", pointerEvents:"all",
            left:0, top:0, width:1, height:1 }}>
            {/* Feather / jump tags */}
            {wireEndpoints.filter(w => w.feather).map(w => {
              const isSel  = selWires.has(w.id);
              const stroke = isSel ? "#fff" : w.color;
              const srcBlock = blocks.find(b => b.id === w.fromBlockId);
              const tgtBlock = blocks.find(b => b.id === w.toBlockId);
              const srcBodyText = pinLabel(tgtBlock, w.toPinId);
              const dstBodyText = pinLabel(srcBlock, w.fromPinId);
              const srcIsLeft = srcBlock && (w.x1 < srcBlock.x + PAD_W);
              const dstIsLeft = tgtBlock && (w.x2 < tgtBlock.x + PAD_W);

              const CHAR_W = 4.8;
              const PAD    = 2;
              const ARR    = 5;
              const H      = ROW_H - 2;
              const TAIL   = GRID * 3;
              const numGap = GRID * 1.5;
              const numW   = (w.cableNum?.length ?? 4) * CHAR_W + 6;
              const srcBW  = Math.ceil(srcBodyText.length * CHAR_W) + PAD * 2 + ARR;
              const dstBW  = Math.ceil(dstBodyText.length * CHAR_W) + PAD * 2 + ARR;

              // chevronPath: cx = flat edge x, goRight=true → tip right, false → tip left
              const chevronPath = (cx, cy, bw, goRight) => {
                if (goRight) return [
                  `M${cx},${cy-H/2}`, `L${cx+bw-ARR},${cy-H/2}`,
                  `L${cx+bw},${cy}`,  `L${cx+bw-ARR},${cy+H/2}`,
                  `L${cx},${cy+H/2}`, `Z`
                ].join(" ");
                return [
                  `M${cx},${cy-H/2}`, `L${cx},${cy+H/2}`,
                  `L${cx-bw+ARR},${cy+H/2}`, `L${cx-bw},${cy}`,
                  `L${cx-bw+ARR},${cy-H/2}`, `Z`
                ].join(" ");
              };

              // ── SOURCE TAG ──────────────────────────────────────────
              const sx0        = w.x1;
              const sy         = w.y1;
              const srcGoRight = !srcIsLeft;
              const srcDefOff  = srcIsLeft ? -TAIL : TAIL;
              const srcOffset  = w.vx  != null ? w.vx  : srcDefOff;
              const srcVx      = sx0 + srcOffset;    // bend / flat-edge x
              const srcNumX    = srcIsLeft ? sx0 - numGap : sx0 + numGap;

              // With turn: srcVy = vertical offset, srcVx2 = extra horiz reach after bend
              const hasSrcTurn = w.srcVy != null;
              const srcBentY   = hasSrcTurn ? sy + w.srcVy : sy;
              // srcVx2 stored as offset from srcVx (independent drag for the new H seg)
              const srcVx2Off  = w.srcVx2 != null ? w.srcVx2 : TAIL;
              const srcVx2     = srcVx + (srcGoRight ? srcVx2Off : -srcVx2Off);

              // Chevron always at end of last horizontal segment
              const srcChevFlatX = hasSrcTurn ? srcVx2 : srcVx;
              const srcChevY     = srcBentY;
              const srcPath      = chevronPath(srcChevFlatX, srcChevY, srcBW, srcGoRight);
              const srcTextX     = srcGoRight ? srcChevFlatX + PAD : srcChevFlatX - PAD;
              const srcTextAnchor = srcGoRight ? "start" : "end";

              // ── DEST TAG ───────────────────────────────────────────
              const dx0        = w.x2;
              const dy         = w.y2;
              const dstGoRight = dstIsLeft;
              const dstDefOff  = dstIsLeft ? -TAIL : TAIL;
              const dstOffset  = w.vx2 != null ? w.vx2 : dstDefOff;
              const dstVx      = dx0 + dstOffset;    // bend / tip x
              const dstNumX    = dstIsLeft ? dx0 - numGap : dx0 + numGap;

              const hasDstTurn = w.dstVy != null;
              const dstBentY   = hasDstTurn ? dy + w.dstVy : dy;
              const dstVx2Off  = w.dstVx2 != null ? w.dstVx2 : TAIL;
              const dstVx2     = dstVx + (dstGoRight ? -dstVx2Off : dstVx2Off);

              // Chevron tip at end of last horizontal
              const dstChevTipX  = hasDstTurn ? dstVx2 : dstVx;
              const dstChevY     = dstBentY;
              const dstChevFlatX = dstGoRight ? dstChevTipX - dstBW : dstChevTipX + dstBW;
              const dstPath      = chevronPath(dstChevFlatX, dstChevY, dstBW, dstGoRight);
              const dstTextX     = dstGoRight ? dstChevFlatX + PAD : dstChevTipX + ARR + PAD;
              const dstTextAnchor = "start";

              // Context menu trigger: detect which tag was right-clicked by proximity to chevron
              const onCtxMenu = (e, tagSide) => {
                e.preventDefault(); e.stopPropagation();
                const r = canvasRef.current.getBoundingClientRect();
                setContextMenu({ x:e.clientX-r.left, y:e.clientY-r.top, wireId:w.id, tagSide });
              };

              return (
                <g key={w.id}
                  onClick={e => { e.stopPropagation(); setSW(new Set([w.id])); setSB(new Set()); }}
                  style={{ cursor:"pointer" }}>

                  {/* ── SOURCE TAIL ── */}
                  {hasSrcTurn ? <>
                    {/* H segments only */}
                    <path
                      d={`M${sx0},${sy} L${srcVx},${sy} M${srcVx},${srcBentY} L${srcChevFlatX},${srcBentY}`}
                      fill="none" stroke={stroke} strokeWidth={1.5}
                      strokeLinejoin="round" style={{ pointerEvents:"none" }} />
                    {/* V segment with crossing arc */}
                    <path
                      d={buildVPathWithArcs([{x:srcVx,y:sy},{x:srcVx,y:srcBentY}], allHSegs.filter(hs => hs.wireId !== w.id))}
                      fill="none" stroke={stroke} strokeWidth={1.5}
                      strokeLinecap="round" style={{ pointerEvents:"none" }} />
                  </> : <line x1={sx0} y1={sy} x2={srcChevFlatX} y2={sy}
                    stroke={stroke} strokeWidth={1.5} style={{ pointerEvents:"none" }} />}
                  {/* Cable number near pin */}
                  <rect x={srcNumX-numW/2} y={sy-5} width={numW} height={10} rx={2}
                    fill="#13161f" opacity={0.9} style={{ pointerEvents:"none" }} />
                  <text x={srcNumX} y={sy} fontSize={7} fill={stroke}
                    textAnchor="middle" dominantBaseline="central"
                    style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                    {w.cableNum}
                  </text>
                  {/* Source chevron + right-click */}
                  <path d={srcPath} fill={isSel ? stroke+"33" : w.color+"22"}
                    stroke={stroke} strokeWidth={isSel ? 1.5 : 1}
                    onContextMenu={e => onCtxMenu(e,"src")} style={{ cursor:"pointer" }} />
                  <text x={srcTextX} y={srcChevY} fontSize={8} fill={stroke}
                    textAnchor={srcTextAnchor} dominantBaseline="central"
                    style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                    {srcBodyText}
                  </text>
                  {/* Source chevron drag handle (ew-resize) — always on last H segment */}
                  <rect
                    x={Math.min(srcChevFlatX, srcGoRight ? srcChevFlatX : srcChevFlatX-srcBW) - 2}
                    y={srcChevY - H/2 - 2} width={srcBW+4} height={H+4}
                    fill="transparent" style={{ cursor:"ew-resize", pointerEvents:"all" }}
                    onContextMenu={e => onCtxMenu(e,"src")}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const r = canvasRef.current.getBoundingClientRect();
                      // With turn: drag moves srcVx2Off; without: moves srcOffset
                      wireDrag.current = hasSrcTurn
                        ? { wireId:w.id, type:"feather_src_vx2", startMouseX:e.clientX-r.left, startVal:srcVx2Off, srcGoRight }
                        : { wireId:w.id, type:"feather_src_vx",  startMouseX:e.clientX-r.left, startVal:srcOffset };
                      mouseDownPos.current = null;
                    }} />
                  {/* Source turn handles */}
                  {hasSrcTurn && (
                    <g>
                      {/* Vertical segment → drag ew to move srcVx */}
                      <line x1={srcVx} y1={Math.min(sy,srcBentY)} x2={srcVx} y2={Math.max(sy,srcBentY)}
                        stroke="transparent" strokeWidth={12} style={{ cursor:"ew-resize" }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const r = canvasRef.current.getBoundingClientRect();
                          wireDrag.current = { wireId:w.id, type:"feather_src_vx", startMouseX:e.clientX-r.left, startVal:srcOffset };
                          mouseDownPos.current = null;
                        }} />
                      {/* New horizontal segment → drag ns to move srcVy */}
                      <line x1={Math.min(srcVx,srcChevFlatX)} y1={srcBentY}
                            x2={Math.max(srcVx,srcChevFlatX)} y2={srcBentY}
                        stroke="transparent" strokeWidth={12} style={{ cursor:"ns-resize" }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const r = canvasRef.current.getBoundingClientRect();
                          wireDrag.current = { wireId:w.id, type:"feather_src_vy", startMouseY:e.clientY-r.top, startVal:w.srcVy };
                          mouseDownPos.current = null;
                        }} />
                    </g>
                  )}

                  {/* ── DEST TAIL ── */}
                  {hasDstTurn ? <>
                    {/* H segments only */}
                    <path
                      d={`M${dx0},${dy} L${dstVx},${dy} M${dstVx},${dstBentY} L${dstChevTipX},${dstBentY}`}
                      fill="none" stroke={stroke} strokeWidth={1.5}
                      strokeLinejoin="round" style={{ pointerEvents:"none" }} />
                    {/* V segment with crossing arc */}
                    <path
                      d={buildVPathWithArcs([{x:dstVx,y:dy},{x:dstVx,y:dstBentY}], allHSegs.filter(hs => hs.wireId !== w.id))}
                      fill="none" stroke={stroke} strokeWidth={1.5}
                      strokeLinecap="round" style={{ pointerEvents:"none" }} />
                  </> : <line x1={dx0} y1={dy} x2={dstChevTipX} y2={dy}
                    stroke={stroke} strokeWidth={1.5} style={{ pointerEvents:"none" }} />}
                  <rect x={dstNumX-numW/2} y={dy-5} width={numW} height={10} rx={2}
                    fill="#13161f" opacity={0.9} style={{ pointerEvents:"none" }} />
                  <text x={dstNumX} y={dy} fontSize={7} fill={stroke}
                    textAnchor="middle" dominantBaseline="central"
                    style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                    {w.cableNum}
                  </text>
                  {/* Dest chevron + right-click */}
                  <path d={dstPath} fill={isSel ? stroke+"33" : w.color+"22"}
                    stroke={stroke} strokeWidth={isSel ? 1.5 : 1}
                    onContextMenu={e => onCtxMenu(e,"dst")} style={{ cursor:"pointer" }} />
                  <text x={dstTextX} y={dstChevY} fontSize={8} fill={stroke}
                    textAnchor={dstTextAnchor} dominantBaseline="central"
                    style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                    {dstBodyText}
                  </text>
                  {/* Dest chevron drag handle */}
                  <rect
                    x={Math.min(dstChevFlatX, dstGoRight ? dstChevFlatX : dstChevFlatX-dstBW) - 2}
                    y={dstChevY - H/2 - 2} width={dstBW+4} height={H+4}
                    fill="transparent" style={{ cursor:"ew-resize", pointerEvents:"all" }}
                    onContextMenu={e => onCtxMenu(e,"dst")}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const r = canvasRef.current.getBoundingClientRect();
                      wireDrag.current = hasDstTurn
                        ? { wireId:w.id, type:"feather_dst_vx2", startMouseX:e.clientX-r.left, startVal:dstVx2Off, dstGoRight }
                        : { wireId:w.id, type:"feather_dst_vx",  startMouseX:e.clientX-r.left, startVal:dstOffset };
                      mouseDownPos.current = null;
                    }} />
                  {/* Dest turn handles */}
                  {hasDstTurn && (
                    <g>
                      <line x1={dstVx} y1={Math.min(dy,dstBentY)} x2={dstVx} y2={Math.max(dy,dstBentY)}
                        stroke="transparent" strokeWidth={12} style={{ cursor:"ew-resize" }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const r = canvasRef.current.getBoundingClientRect();
                          wireDrag.current = { wireId:w.id, type:"feather_dst_vx", startMouseX:e.clientX-r.left, startVal:dstOffset };
                          mouseDownPos.current = null;
                        }} />
                      <line x1={Math.min(dstVx,dstChevTipX)} y1={dstBentY}
                            x2={Math.max(dstVx,dstChevTipX)} y2={dstBentY}
                        stroke="transparent" strokeWidth={12} style={{ cursor:"ns-resize" }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const r = canvasRef.current.getBoundingClientRect();
                          wireDrag.current = { wireId:w.id, type:"feather_dst_vy", startMouseY:e.clientY-r.top, startVal:w.dstVy };
                          mouseDownPos.current = null;
                        }} />
                    </g>
                  )}
                </g>
              );
            })}

                                    {/* Wires */}
            {wireEndpoints.filter(w => !w.feather).map(w => {
              const isSel = selWires.has(w.id);
              const vx = w.vx != null ? w.vx : defaultVx(w.x1, w.x2);
              const turns = w.turns || [];
              const pts = buildWaypoints(w.x1, w.y1, w.x2, w.y2, vx, turns);
              const path = buildPath(pts);
              const stroke = isSel ? "#fff" : w.color;
              const sw = isSel ? 2.5 : 1.5;

              // Labels: 1.5 grids from each pin on first/last H seg
              const GAP = GRID * 1.5;
              const firstVx = turns.length > 0 ? turns[0].vx1 : vx;
              const lastVx  = turns.length > 0 ? turns[turns.length-1].vx2 : vx;
              const srcLx = w.x1 < firstVx ? w.x1 + GAP : w.x1 - GAP;
              const dstLx = w.x2 < lastVx  ? w.x2 + GAP : w.x2 - GAP;
              const labelW = (w.cableNum?.length ?? 4) * 5.5 + 6;

              return (
              <g key={w.id} style={{ pointerEvents:"none" }}>
                {/* Hit area — one <line> per segment so every segment is independently hittable */}
                {(() => {
                  const wireClickProps = {
                    stroke:"rgba(0,0,0,0)", strokeWidth:6,
                    style:{ cursor:"pointer", pointerEvents:"stroke" },
                    onClick: e => { e.stopPropagation(); setSW(new Set([w.id])); setSB(new Set()); },
                    onContextMenu: e => { e.preventDefault(); e.stopPropagation();
                      const rect = canvasRef.current.getBoundingClientRect();
                      setContextMenu({ x:e.clientX-rect.left, y:e.clientY-rect.top, wireId:w.id });
                    }
                  };
                  return pts.slice(1).map((p1, i) => {
                    const p0 = pts[i];
                    return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...wireClickProps} />;
                  });
                })()}
                {/* Visible wire — horizontal segments only; vertical segments rendered in pass 2 below */}
                <path d={buildHPath(pts)} fill="none" stroke={stroke} strokeWidth={sw}
                  strokeDasharray={w.dashed ? "5 3" : "none"}
                  strokeLinejoin="round" strokeLinecap="round"
                  style={{ pointerEvents:"none" }} />

                {turns.length === 0 ? (
                  // Simple wire: single vertical drag handle
                  <line x1={vx} y1={Math.min(w.y1,w.y2)} x2={vx} y2={Math.max(w.y1,w.y2)}
                    stroke="rgba(0,0,0,0)" strokeWidth={8} style={{ cursor:"ew-resize", pointerEvents:"stroke" }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const rect = canvasRef.current.getBoundingClientRect();
                      wireDrag.current = { wireId: w.id, type:'vx', startMouseX: e.clientX - rect.left, startVal: vx };
                      mouseDownPos.current = null;
                    }} />
                ) : (
                  // Turn wire: per-turn drag handles
                  turns.map((t, ti) => {
                    const prevY = ti === 0 ? w.y1 : turns[ti-1].vy;
                    const nextY = ti === turns.length-1 ? w.y2 : turns[ti+1].vy;
                    return (
                      <g key={ti}>
                        {/* vx1 vertical drag (left of turn) */}
                        <line x1={t.vx1} y1={Math.min(prevY,t.vy)} x2={t.vx1} y2={Math.max(prevY,t.vy)}
                          stroke="rgba(0,0,0,0)" strokeWidth={8} style={{ cursor:"ew-resize", pointerEvents:"stroke" }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            const rect = canvasRef.current.getBoundingClientRect();
                            wireDrag.current = { wireId: w.id, type:'vx1', turnIdx: ti, startMouseX: e.clientX - rect.left, startVal: t.vx1 };
                            mouseDownPos.current = null;
                          }} />
                        {/* vx2 vertical drag (right of turn) */}
                        <line x1={t.vx2} y1={Math.min(t.vy,nextY)} x2={t.vx2} y2={Math.max(t.vy,nextY)}
                          stroke="rgba(0,0,0,0)" strokeWidth={8} style={{ cursor:"ew-resize", pointerEvents:"stroke" }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            const rect = canvasRef.current.getBoundingClientRect();
                            wireDrag.current = { wireId: w.id, type:'vx2', turnIdx: ti, startMouseX: e.clientX - rect.left, startVal: t.vx2 };
                            mouseDownPos.current = null;
                          }} />
                        {/* vy horizontal drag (the bridge) */}
                        <line x1={Math.min(t.vx1,t.vx2)} y1={t.vy} x2={Math.max(t.vx1,t.vx2)} y2={t.vy}
                          stroke="rgba(0,0,0,0)" strokeWidth={8} style={{ cursor:"ns-resize", pointerEvents:"stroke" }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            const rect = canvasRef.current.getBoundingClientRect();
                            wireDrag.current = { wireId: w.id, type:'vy', turnIdx: ti, startMouseY: e.clientY - rect.top, startVal: t.vy };
                            mouseDownPos.current = null;
                          }} />
                      </g>
                    );
                  })
                )}

                {/* Source label */}
                <rect x={srcLx - labelW/2} y={w.y1 - 5} width={labelW} height={10} rx={2}
                  fill="#13161f" opacity={0.9} style={{ pointerEvents:"none" }} />
                <text x={srcLx} y={w.y1} fill={stroke} fontSize={7} textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                  {w.cableNum}
                </text>
                {/* Dest label */}
                <rect x={dstLx - labelW/2} y={w.y2 - 5} width={labelW} height={10} rx={2}
                  fill="#13161f" opacity={0.9} style={{ pointerEvents:"none" }} />
                <text x={dstLx} y={w.y2} fill={stroke} fontSize={7} textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontFamily:"monospace", userSelect:"none", pointerEvents:"none" }}>
                  {w.cableNum}
                </text>
              </g>
            )})}

            {/* Pass 2 — vertical segments with crossing arcs, always on top */}
            {wireEndpoints.filter(w => !w.feather).map(w => {
              const isSel  = selWires.has(w.id);
              const vx     = w.vx != null ? w.vx : defaultVx(w.x1, w.x2);
              const turns  = w.turns || [];
              const pts    = buildWaypoints(w.x1, w.y1, w.x2, w.y2, vx, turns);
              const stroke = isSel ? "#fff" : w.color;
              const sw     = isSel ? 2.5 : 1.5;
              const hSegs  = allHSegs.filter(hs => hs.wireId !== w.id);
              const vPath  = buildVPathWithArcs(pts, hSegs);
              if (!vPath) return null;
              return (
                <path key={w.id + '-v'} d={vPath} fill="none" stroke={stroke} strokeWidth={sw}
                  strokeDasharray={w.dashed ? "5 3" : "none"}
                  strokeLinejoin="round" strokeLinecap="round"
                  style={{ pointerEvents:"none" }} />
              );
            })}

                        {/* In-progress wire preview */}
            {drawing && (() => {
              const pvx = snapG((drawing.fromX + drawing.mouseX) / 2);
              const pvPts = buildWaypoints(drawing.fromX, drawing.fromY, drawing.mouseX, drawing.mouseY, pvx, []);
              return <path d={buildPath(pvPts)}
                fill="none" stroke="#ffffff55" strokeWidth={1.5} strokeDasharray="4 3" />;
            })()}

            {/* Feather drawing preview — small chevron follows cursor */}
            {featherDrawing && (() => {
              const fd = featherDrawing;
              const mx = fd.mouseX ?? fd.fromX;
              const my = fd.mouseY ?? fd.fromY;
              const ARR = 6; const H = ROW_H - 2; const PAD = 3;
              const previewText = "···";
              const bw = previewText.length * 4.9 + PAD * 2 + ARR;
              const goRight = mx >= fd.fromX;
              // Right-pointing →: flat left, tip right
              // Left-pointing ←: flat right, tip left
              let chevPath, textX;
              if (goRight) {
                const x0 = mx;              // flat left edge
                chevPath = [
                  `M${x0},${my-H/2}`,
                  `L${x0+bw-ARR},${my-H/2}`,
                  `L${x0+bw},${my}`,
                  `L${x0+bw-ARR},${my+H/2}`,
                  `L${x0},${my+H/2}`,
                  `Z`
                ].join(" ");
                textX = x0 + PAD;
              } else {
                const x0 = mx;              // flat right edge
                chevPath = [
                  `M${x0},${my-H/2}`,
                  `L${x0},${my+H/2}`,
                  `L${x0-bw+ARR},${my+H/2}`,
                  `L${x0-bw},${my}`,
                  `L${x0-bw+ARR},${my-H/2}`,
                  `Z`
                ].join(" ");
                textX = x0 - bw + ARR + PAD;
              }
              return (
                <g style={{ pointerEvents:"none", opacity:0.7 }}>
                  <line x1={fd.fromX} y1={fd.fromY} x2={mx} y2={fd.fromY}
                    stroke="#ffffff66" strokeWidth={1} strokeDasharray="3 3" />
                  <path d={chevPath} fill="#ffffff11" stroke="#ffffff88" strokeWidth={1} />
                  <text x={textX} y={my} fontSize={8} fill="#ffffff88"
                    dominantBaseline="central" style={{ fontFamily:"monospace" }}>
                    {previewText}
                  </text>
                </g>
              );
            })()}

                        {/* Hovered pin highlight ring */}
            {hoveredPin && (() => {
              const b = blocks.find(b => b.id === hoveredPin.blockId);
              if (!b) return null;
              const pos = getPinPositions(b)[hoveredPin.pinId];
              if (!pos) return null;
              const color = SIGNAL_COLORS[expandGroups(b.eq.groups||[]).find(p=>p.id===hoveredPin.pinId)?.signal] || "#fff";
              return <circle cx={pos.x} cy={pos.y} r={DOT_R+4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />;
            })()}
          </svg>

          {/* Blocks */}
          {blocks.map(b => (
            <BlockView key={b.id} block={b} selected={selBlocks.has(b.id)}
              onMouseDownHeader={e => onHeaderMouseDown(e, b.id)}
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                const rect = canvasRef.current.getBoundingClientRect();
                setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, blockId: b.id });
              }} />
          ))}

          {/* ── Annotations (above everything) ── */}
          <svg style={{ position:"absolute", overflow:"visible", pointerEvents:"all",
            left:0, top:0, width:1, height:1, zIndex:100 }}>
            {/* Live preview while drawing */}
            {annotDrawState && (() => {
              const {tool,color,x0,y0,x1,y1}=annotDrawState;
              const px=Math.min(x0,x1),py=Math.min(y0,y1),pw=Math.abs(x1-x0),ph=Math.abs(y1-y0);
              const s={fill:"none",stroke:color,strokeWidth:1.5,strokeDasharray:"5 3",opacity:0.8};
              if(tool==="rect") return <rect x={px} y={py} width={pw} height={ph} {...s}/>;
              if(tool==="ellipse") return <ellipse cx={px+pw/2} cy={py+ph/2} rx={pw/2} ry={ph/2} {...s}/>;
              if(tool==="cloud") return <path d={cloudPath(px,py,px+pw,py+ph)} {...s}/>;
              if(tool==="arrow"||tool==="leader") return <line x1={x0} y1={y0} x2={x1} y2={y1} {...s}/>;
              if(tool==="dimension") return <><line x1={x0} y1={y0} x2={x1} y2={y0} {...s}/><line x1={x0} y1={y0-8} x2={x0} y2={y0+8} stroke={color} strokeWidth={1.5} opacity={0.8}/><line x1={x1} y1={y0-8} x2={x1} y2={y0+8} stroke={color} strokeWidth={1.5} opacity={0.8}/></>;
              return null;
            })()}

            {/* Committed annotations */}
            {annotations.map(a => {
              const isSel = selAnnots.has(a.id);
              const sw = isSel ? 2 : 1.5;
              const stroke = a.color;
              const onAClick = (ev) => {
                ev.stopPropagation();
                if (editingAnnot === a.id) return;
                if (ev.shiftKey) {
                  const next = new Set(selAnnotsRef.current);
                  next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                  setSelAnnots(next);
                } else if (ev.ctrlKey || ev.metaKey) {
                  const next = new Set(selAnnotsRef.current);
                  next.add(a.id);
                  setSelAnnots(next);
                } else {
                  // Only clear other selections if this was a genuine click, not end of drag
                  setSelAnnots(new Set([a.id]));
                  if (!wasAnnotDrag) {
                    setSB(new Set()); setSW(new Set()); setSelLocBoxes(new Set());
                  }
                }
              };
              const onACtx = (ev) => { ev.preventDefault(); ev.stopPropagation();
                const r=canvasRef.current.getBoundingClientRect();
                setContextMenu({x:ev.clientX-r.left,y:ev.clientY-r.top,annotId:a.id});
              };
              const onADblClick = (ev) => { ev.stopPropagation(); setEditingAnnot(a.id); };
              const dragStart = (ev) => {
                if (editingAnnot === a.id) return;
                ev.stopPropagation();
                annotWasDragged.current = false; // reset; set true on first move
                const r=canvasRef.current.getBoundingClientRect();
                // Ensure this annotation is selected
                if (!selAnnotsRef.current.has(a.id)) setSelAnnots(new Set([a.id]));
                // Capture wire vx for wires where both block ends are selected
                const adSelBlocks = selBlocksRef.current;
                const adStartWireVx = {};
                wires.forEach(w => {
                  if (adSelBlocks.has(w.fromBlockId) && adSelBlocks.has(w.toBlockId)) {
                    adStartWireVx[w.id] = {
                      vx: w.vx,
                      turns: w.turns ? w.turns.map(t => ({ ...t })) : [],
                    };
                  }
                });
                annotDrag.current={
                  id:a.id, startX:ev.clientX-r.left, startY:ev.clientY-r.top,
                  origAnnot:{...a},
                  selAnnotIds: selAnnotsRef.current.has(a.id) ? selAnnotsRef.current : new Set([a.id]),
                  startAnnotPositions:{},
                  selLbIds: selLocBoxesRef.current,
                  startLocBoxPositions:{},
                  selBlockIds: selBlocksRef.current,
                  startBlockPositions:{},
                  startWireVx: adStartWireVx,
                };
              };
              const selRing = isSel ? {stroke:"#388bfd",strokeWidth:1,strokeDasharray:"3 2",fill:"none"} : {};

              if(a.tool==="text") {
                const rawText = a.text || "Note";
                const fs = 13;
                const lineH = Math.round(fs * 1.45);
                const PAD = 6;
                const fw = a.w || Math.max(80, rawText.split("\n").reduce((m,l)=>Math.max(m,l.length),0)*7+20);
                const fh = a.h || (rawText.split("\n").length * lineH + 8);
                const isEditing = editingAnnot === a.id;

                // Word-wrap: break each stored line into sub-lines that fit fw-2*PAD
                // Uses a simple char-width estimate matching system-ui font-size 13
                // Use canvas measureText for exact wrap — matches textarea rendering
                // textarea inner width = fw - 6px pad each side - 1.5px border each side = fw - 15
                const maxW = fw - 15;
                const wrapLine = (line) => {
                  if (!line) return [" "];
                  const out = [];
                  let cur = "";
                  // Try word-by-word first, then char-by-char for long words
                  for (const ch of line) {
                    const candidate = cur + ch;
                    if (measureText(candidate, fs) <= maxW) {
                      cur = candidate;
                    } else {
                      if (cur) out.push(cur);
                      cur = ch;
                    }
                  }
                  if (cur) out.push(cur);
                  return out.length ? out : [" "];
                };

                const wrappedLines = rawText.split("\n").flatMap(wrapLine);

                return (
                  <g key={a.id}
                    onClick={onAClick}
                    onContextMenu={onACtx}
                    onDoubleClick={onADblClick}
                    onMouseDown={isEditing ? (ev=>ev.stopPropagation()) : dragStart}
                    style={{cursor: isEditing ? "default" : "move"}}>
                    {/* Transparent hit area */}
                    <rect x={a.x} y={a.y} width={fw} height={fh}
                      fill="rgba(0,0,0,0.01)" stroke="none"/>
                    {/* Wrapped text lines, clipped to box */}
                    {!isEditing && (
                      <>
                        <defs>
                          <clipPath id={`tc-${a.id}`}>
                            <rect x={a.x} y={a.y} width={fw} height={fh}/>
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#tc-${a.id})`}>
                          {wrappedLines.map((ln, li) => (
                            <text key={li}
                              x={a.x + PAD} y={a.y + li*lineH + lineH*0.85}
                              fill={a.color} fontSize={fs}
                              fontFamily="system-ui" fontWeight={500}
                              style={{userSelect:"none", pointerEvents:"none"}}>
                              {ln}
                            </text>
                          ))}
                        </g>
                      </>
                    )}
                    {isSel && !isEditing && (
                      <rect x={a.x-2} y={a.y-2} width={fw+4} height={fh+4}
                        fill="none" stroke="#388bfd"
                        strokeWidth={1} strokeDasharray="3 2" rx={3}/>
                    )}
                  </g>
                );
              }

              if(a.tool==="rect") {
                const w=a.x2-a.x, h=a.y2-a.y;
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <rect x={a.x} y={a.y} width={w} height={h} fill={stroke+"11"} stroke={stroke} strokeWidth={sw} rx={2}/>
                  {isSel&&<rect x={a.x-3} y={a.y-3} width={w+6} height={h+6} {...selRing} rx={4}/>}
                </g>;
              }

              if(a.tool==="ellipse") {
                const rx=(a.x2-a.x)/2, ry=(a.y2-a.y)/2, cx=a.x+rx, cy=a.y+ry;
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={stroke+"11"} stroke={stroke} strokeWidth={sw}/>
                  {isSel&&<ellipse cx={cx} cy={cy} rx={rx+4} ry={ry+4} {...selRing}/>}
                </g>;
              }

              if(a.tool==="cloud") {
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <path d={cloudPath(a.x,a.y,a.x2,a.y2)} fill={stroke+"11"} stroke={stroke} strokeWidth={sw} strokeDasharray="4 2"/>
                  {isSel&&<rect x={a.x-3} y={a.y-3} width={a.x2-a.x+6} height={a.y2-a.y+6} {...selRing} rx={4}/>}
                </g>;
              }

              if(a.tool==="arrow") {
                const dx=a.x2-a.x, dy=a.y2-a.y;
                const len=Math.sqrt(dx*dx+dy*dy)||1;
                const ux=dx/len, uy=dy/len;
                const arrowPts=`${a.x2},${a.y2} ${a.x2-ux*12+uy*5},${a.y2-uy*12-ux*5} ${a.x2-ux*12-uy*5},${a.y2-uy*12+ux*5}`;
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={sw}/>
                  <polygon points={arrowPts} fill={stroke}/>
                  {isSel&&<line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} {...selRing} strokeWidth={8}/>}
                </g>;
              }

              if(a.tool==="leader") {
                const dx=a.x2-a.x, dy=a.y2-a.y;
                const len=Math.sqrt(dx*dx+dy*dy)||1;
                const ux=dx/len, uy=dy/len;
                const arrowPts=`${a.x},${a.y} ${a.x+ux*10-uy*5},${a.y+uy*10+ux*5} ${a.x+ux*10+uy*5},${a.y+uy*10-ux*5}`;
                const labelW=Math.max(60,(a.text||"Label").length*7+12);
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={sw}/>
                  <polygon points={arrowPts} fill={stroke}/>
                  <rect x={a.x2} y={a.y2-9} width={labelW} height={18} rx={3} fill="#1e2433" stroke={stroke} strokeWidth={1}/>
                  {editingAnnot===a.id
                    ?<foreignObject x={a.x2+4} y={a.y2-9} width={labelW-8} height={18}>
                        <input xmlns="http://www.w3.org/1999/xhtml" autoFocus defaultValue={a.text}
                          style={{background:"transparent",border:"none",outline:"none",color:stroke,fontSize:11,fontFamily:"system-ui",width:"100%",height:"100%"}}
                          onBlur={ev=>{setAnnotations(as=>as.map(x=>x.id===a.id?{...x,text:ev.target.value}:x));setEditingAnnot(null);}}
                          onKeyDown={ev=>{if(ev.key==="Enter"||ev.key==="Escape")ev.target.blur();ev.stopPropagation();}}/>
                      </foreignObject>
                    :<text x={a.x2+6} y={a.y2+1} fill={stroke} fontSize={11} fontFamily="system-ui" dominantBaseline="middle" style={{userSelect:"none"}} onDoubleClick={onADblClick}>{a.text||"Label"}</text>
                  }
                  {isSel&&<rect x={a.x2-2} y={a.y2-11} width={labelW+4} height={22} {...selRing} rx={4}/>}
                </g>;
              }

              if(a.tool==="dimension") {
                const dx=a.x2-a.x, dy=a.y2-a.y;
                const len=Math.sqrt(dx*dx+dy*dy)||1;
                const perpX=-dy/len*10, perpY=dx/len*10;
                const midX=(a.x+a.x2)/2, midY=(a.y+a.y2)/2;
                const displayText=a.text||(len/GRID*0.5).toFixed(1)+"m";
                return <g key={a.id} onClick={onAClick} onContextMenu={onACtx} onMouseDown={dragStart} style={{cursor:"move"}}>
                  <line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} stroke={stroke} strokeWidth={sw}/>
                  <line x1={a.x+perpX*0.5} y1={a.y+perpY*0.5} x2={a.x-perpX*0.5} y2={a.y-perpY*0.5} stroke={stroke} strokeWidth={sw}/>
                  <line x1={a.x2+perpX*0.5} y1={a.y2+perpY*0.5} x2={a.x2-perpX*0.5} y2={a.y2-perpY*0.5} stroke={stroke} strokeWidth={sw}/>
                  <rect x={midX-24} y={midY-8} width={48} height={16} rx={2} fill="#0f1117" opacity={0.85}/>
                  {editingAnnot===a.id
                    ?<foreignObject x={midX-22} y={midY-7} width={44} height={14}>
                        <input xmlns="http://www.w3.org/1999/xhtml" autoFocus defaultValue={a.text||displayText}
                          style={{background:"transparent",border:"none",outline:"none",color:stroke,fontSize:9,fontFamily:"monospace",width:"100%",textAlign:"center"}}
                          onBlur={ev=>{setAnnotations(as=>as.map(x=>x.id===a.id?{...x,text:ev.target.value}:x));setEditingAnnot(null);}}
                          onKeyDown={ev=>{if(ev.key==="Enter"||ev.key==="Escape")ev.target.blur();ev.stopPropagation();}}/>
                      </foreignObject>
                    :<text x={midX} y={midY} fill={stroke} fontSize={9} fontFamily="monospace" textAnchor="middle" dominantBaseline="middle" style={{userSelect:"none"}} onDoubleClick={onADblClick}>{displayText}</text>
                  }
                  {isSel&&<line x1={a.x} y1={a.y} x2={a.x2} y2={a.y2} {...selRing} strokeWidth={10}/>}
                </g>;
              }
              return null;
            })}
          </svg>
        </div>

        {/* ── Annotation Toolbar — top right ── */}
        {(() => {
          const tool = ANNOT_TOOLS.find(t=>t.id===activeTool) || ANNOT_TOOLS.find(t=>t.id===lastTool);
          const btnStyle = (active) => ({
            display:"flex",alignItems:"center",justifyContent:"center",
            width:28,height:28,borderRadius:5,border:"none",cursor:"pointer",
            background: active?"#2d3555":"transparent",
            color: active?"#a8d4ff":"#7a8ab0",
            transition:"background 0.1s",
          });
          return (
            <div style={{ position:"absolute", top:12, right:12, zIndex:300, userSelect:"none" }}>
              {/* Collapsed bar */}
              <div style={{ display:"flex", alignItems:"center", gap:0,
                background:"#1e2433", border:"0.5px solid #2d3a52",
                borderRadius:6, padding:"3px 6px", height:28 }}>
                {/* Active tool icon */}
                <div style={{...btnStyle(!!activeTool || !!lastTool),
                  border: activeTool?"1px solid #388bfd": lastTool?"1px solid #3d4663":"none",
                  borderRadius:4, width:24, height:24, marginRight:4}}
                  title={tool ? `${tool.label} (click to reuse)` : "No tool selected"}
                  onClick={()=>{
                    if (activeTool) { setActiveTool(null); setToolbarOpen(false); }
                    else if (lastTool) { setActiveTool(lastTool); setToolbarOpen(false); }
                  }}>
                  {tool ? tool.icon : <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2l2 11 3-4 4 2-9-9z" fill="#7a8ab0"/></svg>}
                </div>
                {/* Color dot */}
                <div style={{width:12,height:12,borderRadius:"50%",background:annotColor,
                  border:"2px solid #388bfd",cursor:"pointer",marginRight:6,flexShrink:0}}
                  onClick={()=>setToolbarOpen(o=>!o)}/>
                {/* Chevron */}
                <div style={{cursor:"pointer",lineHeight:1,color:"#7a8ab0",fontSize:10,transform:toolbarOpen?"rotate(180deg)":"none",transition:"transform 0.15s"}}
                  onClick={()=>setToolbarOpen(o=>!o)}>▾</div>
              </div>

              {/* Dropdown */}
              {toolbarOpen && (
                <div style={{ position:"absolute", top:34, right:0,
                  background:"#1e2433", border:"0.5px solid #2d3a52",
                  borderRadius:7, padding:"6px 0", width:162,
                  boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}>
                  <div style={{fontSize:8,color:"#555e7a",padding:"0 10px 4px",letterSpacing:"0.05em",fontWeight:500}}>TOOL</div>
                  {ANNOT_TOOLS.map(t=>(
                    <div key={t.id}
                      onClick={()=>{setActiveTool(t.id);setToolbarOpen(false);}}
                      style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 10px",
                        cursor:"pointer",background:activeTool===t.id?"#2d3555":"transparent",
                        color:activeTool===t.id?"#c8d0e8":"#9aa3bd",fontSize:11 }}
                      onMouseEnter={e=>e.currentTarget.style.background="#222840"}
                      onMouseLeave={e=>e.currentTarget.style.background=activeTool===t.id?"#2d3555":"transparent"}>
                      <span style={{width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",color:activeTool===t.id?"#a8d4ff":"#7a8ab0",flexShrink:0}}>{t.icon}</span>
                      <span>{t.label}</span>
                      {activeTool===t.id&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"#388bfd",flexShrink:0}}/>}
                    </div>
                  ))}
                  <div style={{borderTop:"0.5px solid #2d3a52",margin:"6px 0"}}/>
                  <div style={{fontSize:8,color:"#555e7a",padding:"0 10px 4px",letterSpacing:"0.05em",fontWeight:500}}>COLOR</div>
                  <div style={{display:"flex",gap:6,padding:"4px 10px"}}>
                    {ANNOT_COLORS.map(c=>(
                      <div key={c} onClick={()=>setAnnotColor(c)}
                        style={{width:16,height:16,borderRadius:"50%",background:c,cursor:"pointer",
                          border: annotColor===c?"2px solid #388bfd":"1.5px solid #3d4663",
                          flexShrink:0}}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Spare cable run modal */}
        {spareModal && (() => {
          const sigOptions = Object.keys(SIGNAL_COLORS);
          let sigVal = sigOptions[0], qtyVal = "1", lenVal = "";
          return (
            <div style={{ position:"absolute", left: spareModal.x, top: spareModal.y,
              zIndex:400, width:220,
              background:"#1e2433", border:"0.5px solid #3d4663",
              borderRadius:8, padding:"12px",
              boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}
              onMouseDown={e => e.stopPropagation()}>
              <div style={{fontSize:10,fontWeight:600,color:"#c8d0e8",marginBottom:10,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>Spare cable run</span>
                <span style={{cursor:"pointer",color:"#555e7a",fontSize:14}}
                  onClick={() => setSpareModal(null)}>✕</span>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,color:"#555e7a",marginBottom:3,
                  textTransform:"uppercase",letterSpacing:"0.05em"}}>Signal type</div>
                <select defaultValue={sigOptions[0]}
                  onChange={ev => { sigVal = ev.target.value; }}
                  style={{width:"100%",background:"#13161f",border:"0.5px solid #3d4663",
                    borderRadius:4,color:"#c8d0e8",fontSize:11,padding:"4px 8px",
                    boxSizing:"border-box"}}>
                  {sigOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,color:"#555e7a",marginBottom:3,
                  textTransform:"uppercase",letterSpacing:"0.05em"}}>Quantity</div>
                <input placeholder="e.g. 4" defaultValue="1"
                  onChange={ev => { qtyVal = ev.target.value; }}
                  onKeyDown={ev => ev.stopPropagation()}
                  style={{width:"100%",background:"#13161f",border:"0.5px solid #3d4663",
                    borderRadius:4,color:"#c8d0e8",fontSize:11,padding:"4px 8px",
                    boxSizing:"border-box",outline:"none"}} />
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,color:"#555e7a",marginBottom:3,
                  textTransform:"uppercase",letterSpacing:"0.05em"}}>Est. length</div>
                <input placeholder="e.g. 15m"
                  onChange={ev => { lenVal = ev.target.value; }}
                  onKeyDown={ev => ev.stopPropagation()}
                  style={{width:"100%",background:"#13161f",border:"0.5px solid #3d4663",
                    borderRadius:4,color:"#c8d0e8",fontSize:11,padding:"4px 8px",
                    boxSizing:"border-box",outline:"none"}} />
              </div>
              <div style={{fontSize:9,color:"#EF9F27",marginBottom:10,lineHeight:1.4}}>
                After clicking Next, click another location box edge to complete
              </div>
              <div style={{display:"flex",gap:8}}>
                <div onClick={() => setSpareModal(null)}
                  style={{flex:1,padding:"5px",fontSize:11,background:"#2d3555",
                    color:"#c8d0e8",borderRadius:5,cursor:"pointer",textAlign:"center"}}>
                  Cancel
                </div>
                <div onClick={() => {
                    setSpareDrawing({
                      fromLocBoxId: spareModal.fromLocBoxId,
                      fromEdgeY: spareModal.fromEdgeY,
                      signal: sigVal,
                      qty: qtyVal || "1",
                      length: lenVal,
                    });
                    setSpareModal(null);
                  }}
                  style={{flex:1,padding:"5px",fontSize:11,background:"#388bfd",
                    color:"#fff",borderRadius:5,cursor:"pointer",textAlign:"center",fontWeight:500}}>
                  Next →
                </div>
              </div>
            </div>
          );
        })()}

        {/* Network info editor modal */}
        {ipInfoModal && (() => {
          const b = blocks.find(x => x.id === ipInfoModal.blockId);
          if (!b) return null;
          const net = b.ipInfo || {};
          const field = (label, key, placeholder, color) => (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:"#555e7a",marginBottom:3,
                textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
              <input
                defaultValue={net[key] || ""}
                placeholder={placeholder}
                onBlur={ev => {
                  const val = ev.target.value.trim();
                  setBlocks(bs => bs.map(x => x.id===b.id
                    ? {...x, ipInfo: {...(x.ipInfo||{}), [key]: val }}
                    : x));
                }}
                onKeyDown={ev => { if(ev.key==="Enter") ev.target.blur(); ev.stopPropagation(); }}
                style={{
                  width:"100%", background:"#13161f",
                  border:`0.5px solid ${color}44`, borderRadius:4,
                  outline:"none", color, fontSize:11,
                  padding:"4px 8px", boxSizing:"border-box",
                  fontFamily:"monospace"
                }}
              />
            </div>
          );
          return (
            <div
              style={{ position:"absolute",
                left: Math.min(ipInfoModal.x, window.innerWidth - 230),
                top: ipInfoModal.y,
                zIndex:400, width:220,
                background:"#1e2433", border:"0.5px solid #3d4663",
                borderRadius:8, padding:"12px",
                boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}
              onMouseDown={e => e.stopPropagation()}>
              <div style={{fontSize:10,fontWeight:600,color:"#c8d0e8",marginBottom:10,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>Network Info — {b.systemName}</span>
                <span style={{cursor:"pointer",color:"#555e7a",fontSize:14,lineHeight:1}}
                  onClick={() => setIpInfoModal(null)}>✕</span>
              </div>
              {field("IP Address",  "ip",   "e.g. 192.168.1.100", "#1D9E75")}
              {field("MAC Address", "mac",  "e.g. AA:BB:CC:DD:EE:FF", "#85B7EB")}
              {field("Port",        "port", "e.g. 80", "#EF9F27")}
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                <div onClick={() => setIpInfoModal(null)}
                  style={{padding:"5px 14px",fontSize:11,background:"#388bfd",
                    color:"#fff",borderRadius:5,cursor:"pointer",fontWeight:500}}>
                  Done
                </div>
              </div>
            </div>
          );
        })()}

        {/* Text annotation editing overlay */}
        {(() => {
          if (!editingAnnot) return null;
          const a = annotations.find(x => x.id === editingAnnot);
          if (!a || a.tool !== "text") return null;
          const sx = Math.round(a.x * zoom + pan.x);
          const sy = Math.round((a.y - 2) * zoom + pan.y);
          const fs = Math.max(9, Math.round(13 * zoom));
          const lh = Math.round(fs * 1.45);
          const initLines = (a.text || "Note").split("\n");
          // Use a ref to capture textarea value — avoids onBlur/setState race
          const taRef = (el) => {
            if (el) {
              el.focus();
              el.setSelectionRange(el.value.length, el.value.length);
            }
          };
          const commitEdit = (el) => {
            if (!el) return;
            const val = el.value;
            // Save the textarea's dragged pixel size back to canvas units
            const w = Math.round(el.offsetWidth / zoom);
            const h = Math.round(el.offsetHeight / zoom);
            setAnnotations(as => as.map(x =>
              x.id === a.id ? { ...x, text: val, w, h } : x
            ));
            setEditingAnnot(null);
          };
          return (
            <div
              key={"tedit-" + editingAnnot}
              style={{
                position:"absolute", left:sx, top:sy,
                zIndex:600, pointerEvents:"all"
              }}
              onMouseDown={ev => { ev.stopPropagation(); ev.preventDefault(); }}
              onPointerDown={ev => { ev.stopPropagation(); ev.preventDefault(); }}>
              <textarea
                ref={taRef}
                defaultValue={a.text || "Note"}
                style={{
                  display:"block",
                  background:"rgba(13,16,26,0.97)",
                  border:"1.5px solid #388bfd",
                  borderRadius:3,
                  outline:"none",
                  color: a.color,
                  fontSize: fs,
                  fontFamily:"system-ui,sans-serif",
                  fontWeight:500,
                  lineHeight: lh + "px",
                  padding:"3px 6px",
                  width: a.w ? Math.round(a.w * zoom) : undefined,
                  height: a.h ? Math.round(a.h * zoom) : undefined,
                  minWidth:120,
                  minHeight: initLines.length * lh + 16,
                  resize:"both",
                  boxSizing:"border-box",
                  whiteSpace:"pre-wrap",
                  wordBreak:"break-all",
                  overflowWrap:"break-word",
                  overflow:"hidden",
                  userSelect:"text",
                  WebkitUserSelect:"text",
                  cursor:"text",
                  tabIndex:0
                }}
                onBlur={ev => commitEdit(ev.target)}
                onKeyDown={ev => {
                  if (ev.key === "Escape") ev.target.blur();
                  ev.stopPropagation();
                }}
                onMouseDown={ev => ev.stopPropagation()}
                onPointerDown={ev => ev.stopPropagation()}
                onClick={ev => ev.stopPropagation()}
              />
            </div>
          );
        })()}

        {/* Canvas context menu (empty space / loc box) */}
        {contextMenu && !contextMenu.wireId && (
          <div style={{ position:"absolute", left:contextMenu.x, top:contextMenu.y, zIndex:200,
            background:"#1e2433", border:"0.5px solid #3d4663", borderRadius:7,
            padding:"4px 0", minWidth:160, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}
            onMouseLeave={() => setContextMenu(null)}>
            <div style={{ padding:"4px 12px 2px", fontSize:9, color:"#555e7a",
              textTransform:"uppercase", letterSpacing:"0.05em" }}>Canvas</div>
            <div onClick={() => {
                const DEFAULT_W = GRID * 20, DEFAULT_H = GRID * 16;
                const cx = contextMenu.canvasX - DEFAULT_W / 2;
                const cy = contextMenu.canvasY - DEFAULT_H / 2;
                setLocBoxes(lbs => [...lbs, {
                  id: `lb-${_locBoxId++}`,
                  x: snap(cx), y: snap(cy),
                  w: DEFAULT_W, h: DEFAULT_H,
                  label: "Location"
                }]);
                setContextMenu(null);
              }}
              style={{ padding:"7px 14px", fontSize:12, color:"#c8d0e8", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background="#2d3555"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              Add location box
            </div>
            {contextMenu.nearLocBoxId && (
              <div onClick={() => {
                  setSpareModal({ fromLocBoxId: contextMenu.nearLocBoxId,
                    fromEdgeY: contextMenu.nearEdgeY,
                    x: contextMenu.x, y: contextMenu.y });
                  setContextMenu(null);
                }}
                style={{ padding:"7px 14px", fontSize:12, color:"#c8d0e8", cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.background="#2d3555"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                Add spare cable run
              </div>
            )}

          </div>
        )}

        {/* Block context menu */}
        {contextMenu && contextMenu.blockId && (() => {
          const b = blocks.find(x => x.id === contextMenu.blockId);
          if (!b) return null;
          const net = b.ipInfo || {};
          const hasAny = net.ip || net.mac || net.port;
          return (
            <div style={{ position:"absolute", left:contextMenu.x, top:contextMenu.y, zIndex:200,
              background:"#1e2433", border:"0.5px solid #3d4663", borderRadius:7,
              padding:"4px 0", minWidth:160, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}
              onMouseLeave={() => setContextMenu(null)}>
              <div style={{padding:"4px 12px 2px",fontSize:9,color:"#555e7a",
                textTransform:"uppercase",letterSpacing:"0.05em"}}>
                {b.systemName || b.eq?.model}
              </div>
              <div onClick={() => {
                  setSwapModal({ blockId: b.id });
                  setContextMenu(null);
                }}
                style={{padding:"7px 14px",fontSize:12,color:"#c8d0e8",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="#2d3555"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                Swap equipment…
              </div>
              <div onClick={() => {
                  setIpInfoModal({ blockId: b.id, x: contextMenu.x, y: contextMenu.y });
                  setContextMenu(null);
                }}
                style={{padding:"7px 14px",fontSize:12,color:"#c8d0e8",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="#2d3555"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {hasAny ? "Edit network info" : "Add network info"}
              </div>
              {hasAny && (
                <div onClick={() => {
                    setBlocks(bs => bs.map(x => x.id===b.id ? {...x, ipInfo:{}} : x));
                    setContextMenu(null);
                  }}
                  style={{padding:"7px 14px",fontSize:12,color:"#f87171",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#2d1515"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  Clear network info
                </div>
              )}
            </div>
          );
        })()}

        {/* Annotation context menu */}
        {contextMenu && contextMenu.annotId && (
          <div style={{ position:"absolute", left:contextMenu.x, top:contextMenu.y, zIndex:200,
            background:"#1e2433", border:"0.5px solid #3d4663", borderRadius:7,
            padding:"4px 0", minWidth:140, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}
            onMouseLeave={() => setContextMenu(null)}>
            <div style={{padding:"4px 12px 2px",fontSize:9,color:"#555e7a",textTransform:"uppercase",letterSpacing:"0.05em"}}>
              {ANNOT_TOOLS.find(t=>t.id===annotations.find(a=>a.id===contextMenu.annotId)?.tool)?.label||"Annotation"}
            </div>
            {[
              ["Edit text", () => { setEditingAnnot(contextMenu.annotId); setContextMenu(null); }],
              ["Duplicate", () => {
                const src = annotations.find(a=>a.id===contextMenu.annotId);
                if(src) setAnnotations(as=>[...as,{...src,id:`a-${_annotId++}`,x:src.x+GRID*2,y:src.y+GRID*2,
                  x2:src.x2!=null?src.x2+GRID*2:undefined,y2:src.y2!=null?src.y2+GRID*2:undefined}]);
                setContextMenu(null);
              }],
            ].map(([label,fn])=>(
              <div key={label} onClick={fn}
                style={{padding:"7px 14px",fontSize:12,color:"#c8d0e8",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="#2d3555"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{label}</div>
            ))}
            <div onClick={()=>{setAnnotations(as=>as.filter(a=>a.id!==contextMenu.annotId));setSelAnnots(new Set());setContextMenu(null);}}
              style={{padding:"7px 14px",fontSize:12,color:"#f87171",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="#2d1515"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>Delete</div>
          </div>
        )}

        {/* Wire context menu */}
        {contextMenu && contextMenu.wireId && (
          <div style={{ position:"absolute", left: contextMenu.x, top: contextMenu.y, zIndex:200,
            background:"#1e2433", border:"0.5px solid #3d4663", borderRadius:7,
            padding:"4px 0", minWidth:150, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}
            onMouseLeave={() => setContextMenu(null)}>
            {(() => {
              const ctxW = wires.find(w => w.id === contextMenu.wireId);
              const isFeather = ctxW?.feather;
              const menuItem = (label, onClick, color="#c8d0e8", hoverBg="#2d3555") => (
                <div onClick={onClick}
                  style={{ padding:"7px 14px", fontSize:12, color, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background=hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  {label}
                </div>
              );
              return (<>
                <div style={{ padding:"4px 12px 2px", fontSize:9, color:"#555e7a", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  {isFeather ? "Jump tag" : "Wire"}
                </div>

                {/* Convert wire ↔ feather */}
                {menuItem(isFeather ? "Convert to wire" : "Convert to jump tag", () => {
                  setWires(ws => ws.map(w => w.id === contextMenu.wireId ? { ...w, feather: !w.feather, turns: [] } : w));
                  setContextMenu(null);
                })}

                {/* Add/remove turn */}
                {isFeather ? (() => {
                  // tagSide set by which chevron was right-clicked
                  const side = contextMenu.tagSide || "src";
                  const hasTurn = side === "src"
                    ? wires.find(w=>w.id===contextMenu.wireId)?.srcVy != null
                    : wires.find(w=>w.id===contextMenu.wireId)?.dstVy != null;
                  return (<>
                    {!hasTurn && menuItem("Add turn", () => {
                      setWires(ws => ws.map(w => {
                        if (w.id !== contextMenu.wireId) return w;
                        return side === "src"
                          ? { ...w, srcVy: GRID * 4, srcVx2: null }
                          : { ...w, dstVy: GRID * 4, dstVx2: null };
                      }));
                      setContextMenu(null);
                    })}
                    {hasTurn && menuItem("Remove turn", () => {
                      setWires(ws => ws.map(w => {
                        if (w.id !== contextMenu.wireId) return w;
                        return side === "src"
                          ? { ...w, srcVy: null, srcVx2: null }
                          : { ...w, dstVy: null, dstVx2: null };
                      }));
                      setContextMenu(null);
                    })}
                  </>);
                })() : (<>
                  {menuItem("Add turn", () => {
                    setWires(ws => ws.map(w => {
                      if (w.id !== contextMenu.wireId) return w;
                      const ep = wireEndpointsRef.current.find(e => e.id === w.id);
                      if (!ep) return w;
                      return { ...w, turns: addTurn(ep.x1, ep.y1, ep.x2, ep.y2, w.vx, w.turns || []) };
                    }));
                    setContextMenu(null);
                  })}
                  {menuItem("Remove turn", () => {
                    setWires(ws => ws.map(w => {
                      if (w.id !== contextMenu.wireId) return w;
                      const ep = wireEndpointsRef.current.find(e => e.id === w.id);
                      if (!ep || !w.turns?.length) return w;
                      const ccx = (contextMenu.x - pan.x) / zoom;
                      const ccy = (contextMenu.y - pan.y) / zoom;
                      return { ...w, turns: removeTurn(ep.x1, ep.y1, ep.x2, ep.y2, w.vx, w.turns, ccx, ccy) };
                    }));
                    setContextMenu(null);
                  })}
                </>)}

                {/* Reconnect from source */}
                {menuItem("Reconnect from source", () => {
                  const w = wires.find(w => w.id === contextMenu.wireId);
                  if (w) {
                    const src = blocks.find(b => b.id === w.fromBlockId);
                    const fp = src ? getPinPositions(src)[w.fromPinId] : null;
                    if (fp) {
                      if (w.feather) setFeatherDrawing({ fromBlockId: w.fromBlockId, fromPinId: w.fromPinId, fromX: fp.x, fromY: fp.y });
                      else setDrawing({ fromBlockId: w.fromBlockId, fromPinId: w.fromPinId, fromX: fp.x, fromY: fp.y, mouseX: fp.x, mouseY: fp.y });
                    }
                    setWires(ws => ws.filter(x => x.id !== contextMenu.wireId));
                  }
                  setContextMenu(null);
                })}

                {/* Reconnect from destination */}
                {menuItem("Reconnect from destination", () => {
                  const w = wires.find(w => w.id === contextMenu.wireId);
                  if (w) {
                    const tgt = blocks.find(b => b.id === w.toBlockId);
                    const tp = tgt ? getPinPositions(tgt)[w.toPinId] : null;
                    if (tp) {
                      // Swap src/dst so user reconnects from the dest pin
                      if (w.feather) setFeatherDrawing({ fromBlockId: w.toBlockId, fromPinId: w.toPinId, fromX: tp.x, fromY: tp.y });
                      else setDrawing({ fromBlockId: w.toBlockId, fromPinId: w.toPinId, fromX: tp.x, fromY: tp.y, mouseX: tp.x, mouseY: tp.y });
                    }
                    setWires(ws => ws.filter(x => x.id !== contextMenu.wireId));
                  }
                  setContextMenu(null);
                })}

                {/* Delete */}
                {menuItem("Delete", () => {
                  setWires(ws => ws.filter(w => w.id !== contextMenu.wireId));
                  setContextMenu(null);
                }, "#f87171", "#2d1515")}
              </>);
            })()}
          </div>
        )}

        {/* ── Orphan wire overlay ── */}
        {orphanWires.length > 0 && (() => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return null;
          return (<>
            {/* SVG for the dashed lines — pointer-events:none so canvas still works */}
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%',
              pointerEvents:'none', zIndex:60, overflow:'visible' }}>
              {orphanWires.map(ow => {
                const aliveBlock = blocks.find(b => b.id === ow.aliveBlockId);
                if (!aliveBlock) return null;
                const alivePin = getPinPositions(aliveBlock)[ow.alivePinId];
                if (!alivePin) return null;
                const ax = alivePin.x * zoom + pan.x;
                const ay = alivePin.y * zoom + pan.y;
                const fx = ow.floatCanvasX * zoom + pan.x;
                const fy = ow.floatCanvasY * zoom + pan.y;
                const color = SIGNAL_COLORS[ow.signal] || '#888';
                const active = draggingOrphan?.orphanId === ow.id;
                return (
                  <g key={ow.id}>
                    <line x1={ax} y1={ay} x2={fx} y2={fy}
                      stroke={color} strokeWidth={1.5}
                      strokeDasharray={ow.feather ? '3 3' : '5 4'}
                      opacity={0.65} />
                    {ow.feather ? (
                      <rect x={fx-7} y={fy-7} width={14} height={14} rx={2}
                        fill={color} transform={`rotate(45 ${fx} ${fy})`}
                        opacity={active ? 1 : 0.85}
                        stroke={active ? '#fff' : 'none'} strokeWidth={1.5} />
                    ) : (
                      <circle cx={fx} cy={fy} r={7}
                        fill={color}
                        opacity={active ? 1 : 0.85}
                        stroke={active ? '#fff' : 'none'} strokeWidth={1.5} />
                    )}
                    {active && (
                      <circle cx={fx} cy={fy} r={13}
                        fill="none" stroke={color} strokeWidth={1} opacity={0.5}
                        style={{ animation:'orphan-pulse 1s ease-in-out infinite' }} />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Invisible hit divs — drag to reconnect, right-click to delete */}
            {orphanWires.map(ow => {
              if (draggingOrphan?.orphanId === ow.id) return null; // hide the one being dragged
              const aliveBlock = blocks.find(b => b.id === ow.aliveBlockId);
              if (!aliveBlock) return null;
              if (!getPinPositions(aliveBlock)[ow.alivePinId]) return null;
              const fx = ow.floatCanvasX * zoom + pan.x;
              const fy = ow.floatCanvasY * zoom + pan.y;
              const tooltip = `${ow.originalPinLabel} — was on ${ow.originalBlockLabel}\nDrag to a pin to reconnect · Right-click to delete`;
              return (
                <div key={`hit-${ow.id}`} title={tooltip}
                  style={{
                    position: 'absolute',
                    left: fx - 12, top: fy - 12,
                    width: 24, height: 24,
                    borderRadius: '50%',
                    cursor: 'grab',
                    zIndex: 61,
                    background: 'transparent',
                  }}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const r = canvasRef.current.getBoundingClientRect();
                    const cx = (e.clientX - r.left - pan.x) / zoom;
                    const cy = (e.clientY - r.top  - pan.y) / zoom;
                    const drag = { orphanId: ow.id, mouseCanvasX: cx, mouseCanvasY: cy };
                    draggingOrphanRef.current = drag;
                    setDraggingOrphan(drag);
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const r = canvasRef.current.getBoundingClientRect();
                    setContextMenu({ x: e.clientX - r.left, y: e.clientY - r.top, orphanId: ow.id });
                  }}
                />
              );
            })}
          </>);
        })()}

        {/* ── Orphan drag preview line ── */}
        {draggingOrphan && (() => {
          const ow = orphanWires.find(o => o.id === draggingOrphan.orphanId);
          if (!ow) return null;
          const aliveBlock = blocks.find(b => b.id === ow.aliveBlockId);
          if (!aliveBlock) return null;
          const alivePin = getPinPositions(aliveBlock)[ow.alivePinId];
          if (!alivePin) return null;
          const ax = alivePin.x * zoom + pan.x;
          const ay = alivePin.y * zoom + pan.y;
          const mx = draggingOrphan.mouseCanvasX * zoom + pan.x;
          const my = draggingOrphan.mouseCanvasY * zoom + pan.y;
          const color = SIGNAL_COLORS[ow.signal] || '#888';
          return (
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%',
              pointerEvents:'none', zIndex:62, overflow:'visible' }}>
              <line x1={ax} y1={ay} x2={mx} y2={my}
                stroke={color} strokeWidth={2} strokeDasharray="5 4" opacity={0.9} />
              <circle cx={mx} cy={my} r={8} fill={color} opacity={0.9} />
              <circle cx={mx} cy={my} r={14} fill="none"
                stroke={color} strokeWidth={1} opacity={0.5}
                style={{ animation:'orphan-pulse 0.8s ease-in-out infinite' }} />
            </svg>
          );
        })()}

        {/* ── Orphan context menu ── */}        {/* ── Orphan context menu ── */}
        {contextMenu?.orphanId && (() => {
          const ow = orphanWires.find(o => o.id === contextMenu.orphanId);
          if (!ow) return null;
          return (
            <div style={{ position:'absolute', left:contextMenu.x, top:contextMenu.y, zIndex:200,
              background:'#1e2433', border:'0.5px solid #3d4663', borderRadius:7,
              padding:'4px 0', minWidth:180, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}
              onMouseLeave={() => setContextMenu(null)}>
              <div style={{ padding:'4px 12px 2px', fontSize:9, color:'#555e7a', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {ow.feather ? 'Jump tag' : 'Wire'} — orphan
              </div>
              <div style={{ padding:'4px 12px 8px', fontSize:11, color:'#7a8ab0', borderBottom:'0.5px solid #2d3555' }}>
                {ow.originalPinLabel} on {ow.originalBlockLabel}
              </div>

              <div onClick={() => { setOrphanWires(os => os.filter(o => o.id !== ow.id)); setContextMenu(null); }}
                style={{ padding:'7px 14px', fontSize:12, color:'#f87171', cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='#2d1515'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                Delete wire
              </div>
            </div>
          );
        })()}

        {/* ── Swap picker modal ── */}
        {swapModal && (() => {
          const oldBlock = blocks.find(b => b.id === swapModal.blockId);
          if (!oldBlock) return null;
          const allMfrs = ['All', ...Array.from(new Set(SAMPLE_LIBRARY.map(e => e.manufacturer).filter(Boolean))).sort()];
          const allCats = ['All', ...Array.from(new Set(SAMPLE_LIBRARY.map(e => e.category).filter(Boolean))).sort()];
          const q = swapSearch.toLowerCase();
          const filtered = SAMPLE_LIBRARY.filter(eq => {
            const matchQ = !q || eq.manufacturer?.toLowerCase().includes(q) || eq.model?.toLowerCase().includes(q);
            const matchC = swapCat === 'All' || eq.category === swapCat;
            const matchM = swapMfr === 'All' || eq.manufacturer === swapMfr;
            return matchQ && matchC && matchM;
          });
          const menuStyle = (hover) => ({
            padding:'7px 14px', fontSize:12, color:'#c8d0e8', cursor:'pointer',
            background: hover ? '#2d3555' : 'transparent',
          });
          return (
            <div style={{ position:'absolute', inset:0, zIndex:300,
              background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={e => { if (e.target === e.currentTarget) setSwapModal(null); }}>
              <div style={{ background:'#1e2433', border:'0.5px solid #3d4663', borderRadius:12,
                width:520, maxHeight:'75vh', display:'flex', flexDirection:'column',
                boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>

                {/* Header */}
                <div style={{ padding:'14px 18px 10px', borderBottom:'0.5px solid #2d3555', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#c8d0e8', marginBottom:10 }}>
                    Swap equipment — replacing&nbsp;
                    <span style={{ color:'#a8d4ff' }}>{oldBlock.systemName || oldBlock.eq?.model}</span>
                  </div>
                  {/* Search + filters */}
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      autoFocus
                      value={swapSearch}
                      onChange={e => setSwapSearch(e.target.value)}
                      placeholder="Search model, manufacturer…"
                      style={{ flex:1, background:'#13161f', border:'0.5px solid #3d4663', borderRadius:6,
                        color:'#c8d0e8', fontSize:12, padding:'6px 10px', outline:'none' }}
                      onKeyDown={e => e.key === 'Escape' && setSwapModal(null)}
                    />
                    <select value={swapCat} onChange={e => setSwapCat(e.target.value)}
                      style={{ background:'#13161f', border:'0.5px solid #3d4663', borderRadius:6,
                        color:'#c8d0e8', fontSize:12, padding:'6px 8px', cursor:'pointer' }}>
                      {allCats.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
                    </select>
                    <select value={swapMfr} onChange={e => setSwapMfr(e.target.value)}
                      style={{ background:'#13161f', border:'0.5px solid #3d4663', borderRadius:6,
                        color:'#c8d0e8', fontSize:12, padding:'6px 8px', cursor:'pointer' }}>
                      {allMfrs.map(m => <option key={m} value={m}>{m === 'All' ? 'All manufacturers' : m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Library list */}
                <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
                  {filtered.length === 0 && (
                    <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:'#555e7a' }}>
                      No blocks found
                    </div>
                  )}
                  {filtered.map(eq => (
                    <div key={eq.id}
                      onClick={() => doSwap(swapModal.blockId, eq)}
                      style={{ padding:'8px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                        borderBottom:'0.5px solid #1a1f2e' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#2d3555'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:'#c8d0e8', fontWeight:500 }}>{eq.model}</div>
                        <div style={{ fontSize:11, color:'#7a8ab0', marginTop:1 }}>{eq.manufacturer} · {eq.category}</div>
                      </div>
                      <div style={{ fontSize:10, color:'#555e7a' }}>
                        {eq.groups?.reduce((s,g)=>s+g.qty,0) || 0} pins
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create new block footer */}
                <div style={{ borderTop:'0.5px solid #2d3555', flexShrink:0 }}>
                  <div
                    onClick={() => window.open('http://localhost:5174', '_blank')}
                    style={{ padding:'10px 18px', cursor:'pointer', fontSize:12, color:'#388bfd',
                      display:'flex', alignItems:'center', gap:8 }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(56,139,253,0.08)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    + Create new block in Block Library…
                  </div>
                  <div onClick={() => setSwapModal(null)}
                    style={{ padding:'8px 18px 12px', cursor:'pointer', fontSize:12, color:'#555e7a',
                      textAlign:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#1a1f2e'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    Cancel
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Marquee selection box */}
        {marquee && (() => {
          const sx2 = marquee.x1 * zoom + pan.x, sy2 = marquee.y1 * zoom + pan.y;
          const ex  = marquee.x2 * zoom + pan.x, ey  = marquee.y2 * zoom + pan.y;
          const x = Math.min(sx2,ex), y = Math.min(sy2,ey);
          const w = Math.abs(ex-sx2), h = Math.abs(ey-sy2);
          const isWindow = marquee.x2 >= marquee.x1;
          return (
            <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:50 }}>
              <rect x={x} y={y} width={w} height={h}
                fill={isWindow ? "rgba(56,139,253,0.06)" : "rgba(56,220,100,0.06)"}
                stroke={isWindow ? "#388bfd" : "#38dc64"}
                strokeWidth={1}
                strokeDasharray={isWindow ? "none" : "5 3"} />
            </svg>
          );
        })()}

        {/* Empty hint */}
        {blocks.length === 0 && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
            justifyContent:"center", pointerEvents:"none" }}>
            <div style={{ textAlign:"center", color:"#2d3a52" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>⟵</div>
              <div style={{ fontSize:14, fontWeight:500 }}>Drag equipment from the library</div>
              <div style={{ fontSize:11, marginTop:4 }}>Click a pin dot to start wiring · Scroll to zoom · Alt+drag to pan</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
