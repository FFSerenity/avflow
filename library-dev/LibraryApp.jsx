import { useState, useEffect, useRef } from "react";
import { SAMPLE_LIBRARY } from "../src/components/Sidebar.jsx";
import { fsaSupported, loadHandle, saveHandle, verifyPermission, pickDirectory,
         readAllBlocks, saveBlock, deleteBlock, fetchFromUrl } from "../src/db.js";

// ── CSS variables ─────────────────────────────────────────────────────────────
const _style = document.createElement("style");
_style.id = "__lib-theme";
_style.textContent = `
  :root {
    --font-sans: system-ui, sans-serif;
    --color-background-primary:   #13161f;
    --color-background-secondary: #1e2433;
    --color-background-info:      rgba(56,139,253,0.15);
    --color-background-danger:    rgba(226,75,74,0.15);
    --color-border-primary:       #3d4663;
    --color-border-secondary:     #2d3a52;
    --color-border-tertiary:      #1e2433;
    --color-border-info:          #388bfd;
    --color-border-danger:        #E24B4A;
    --color-text-primary:         #c8d0e8;
    --color-text-secondary:       #8892a8;
    --color-text-tertiary:        #555e7a;
    --color-text-info:            #388bfd;
    --color-text-danger:          #E24B4A;
  }
  input, select, textarea {
    background: var(--color-background-secondary);
    border: 0.5px solid var(--color-border-primary);
    border-radius: 5px;
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
    padding: 4px 8px;
    width: 100%;
    outline: none;
  }
  input:focus, select:focus { border-color: var(--color-border-info); }
  button {
    background: var(--color-background-secondary);
    border: 0.5px solid var(--color-border-primary);
    border-radius: 6px;
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 13px;
    padding: 6px 14px;
  }
  button:hover { border-color: var(--color-border-info); }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2d3a52; border-radius: 3px; }
`;
if (!document.getElementById("__lib-theme")) document.head.appendChild(_style);

// ── Canvas layout constants — must stay in sync with src/constants.js ─────────
const GRID     = 16;
const ROW_H    = 16;
const HEADER_H = 40;
const FOOTER_H = 16;
const BODY_W   = 160;
const STUB_W   = 28;
const PAD_W    = 64;
const DOT_R    = 4;

// ── Signal colours — must stay in sync with src/constants.js ─────────────────
const SIGNAL_COLORS = {
  "HDMI":"#E24B4A","DisplayPort":"#E24B4A","DVI":"#E24B4A","VGA":"#E24B4A","SDI":"#E24B4A",
  "USB-A":"#7F77DD","USB-B":"#7F77DD","USB-C":"#7F77DD","USB 2.0":"#7F77DD","USB 3.0":"#7F77DD",
  "RJ45 LAN":"#1D9E75","RJ45 PoE":"#1D9E75","RJ45 PoE+":"#1D9E75","RJ45 PoE++":"#1D9E75","RJ45 DM":"#1D9E75",
  "3.5mm Stereo":"#EF9F27","3.5mm Mono":"#EF9F27","XLR":"#EF9F27","RCA":"#EF9F27",
  "Phoenix 2-pin":"#EF9F27","Phoenix 3-pin":"#EF9F27","Phoenix 5-pin":"#EF9F27","Phoenix 6-pin":"#EF9F27",
  "RS-232":"#D4537E","RS-485":"#D4537E","IR":"#D4537E","GPIO":"#D4537E","Relay":"#D4537E",
  "IEC Power":"#888780","NEMA 5-15":"#888780","DC Barrel":"#888780","DC Phoenix":"#888780",
  "Fiber":"#85B7EB","Coaxial":"#85B7EB","BNC":"#85B7EB","Other":"#B4B2A9"
};

const SIGNAL_TYPES = [
  "HDMI","DisplayPort","DVI","VGA","SDI",
  "USB-A","USB-B","USB-C","USB 2.0","USB 3.0",
  "RJ45 LAN","RJ45 PoE","RJ45 PoE+","RJ45 PoE++","RJ45 DM",
  "3.5mm Stereo","3.5mm Mono","XLR","RCA",
  "Phoenix 2-pin","Phoenix 3-pin","Phoenix 5-pin","Phoenix 6-pin",
  "RS-232","RS-485","IR","GPIO","Relay",
  "IEC Power","NEMA 5-15","DC Barrel","DC Phoenix",
  "Fiber","Coaxial","BNC","Other"
];

const CONNECTOR_TYPES = [
  "HDMI Type A","HDMI Type D (Micro)","DisplayPort","Mini DisplayPort",
  "DVI-D","DVI-I","VGA (DE-15)","BNC",
  "USB Type-A","USB Type-B","USB Type-C","USB Micro-B","USB Mini-B",
  "RJ45","RJ11",
  "XLR 3-pin","XLR 5-pin","TRS 3.5mm","TRS 6.35mm","TS 3.5mm","TRRS 3.5mm","RCA",
  "Phoenix 2-pin","Phoenix 3-pin","Phoenix 5-pin","Phoenix 6-pin",
  "DB9 (RS-232)","DB25","Terminal Block",
  "IEC 60320 C13","IEC 60320 C19","NEMA 5-15R","NEMA 5-20R",
  "DC Barrel 5.5/2.1mm","DC Barrel 5.5/2.5mm",
  "LC Fiber","SC Fiber","ST Fiber","F-Type","SMA","Other"
];

const PORT_DIRECTIONS = ["Input","Output","Bidirectional"];
const CATEGORIES = ["Display","Video Processing","Audio","Control","Network","Power","Camera","Microphone","Laptop/PC","Other"];

const RACK_U_PRESETS = [
  {u:1,inch:1.75,mm:44.45},{u:2,inch:3.5,mm:88.9},{u:3,inch:5.25,mm:133.35},
  {u:4,inch:7,mm:177.8},{u:5,inch:8.75,mm:222.25},{u:6,inch:10.5,mm:266.7},
  {u:8,inch:14,mm:355.6},{u:10,inch:17.5,mm:444.5},{u:12,inch:21,mm:533.4},
  {u:14,inch:24.5,mm:622.3},{u:16,inch:28,mm:711.2},
];

const newGroup = (side) => ({
  id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  signal: "HDMI", qty: 1, connector: "HDMI Type A",
  direction: "Input", side, description: ""
});

const defaultNewEquipment = () => ({
  id: `eq-${Date.now()}`, manufacturer: "", model: "", category: "Other",
  width: 17, height: 1.75, depth: 8, unit: "in", wattage: 0,
  systemName: "", location: "COMM1", notes: "", groups: []
});

function expandGroups(groups) {
  const pins = [];
  groups.forEach(g => {
    const base = (g.description && g.description.trim()) ? g.description.trim() : g.signal;
    for (let i = 1; i <= Math.max(1, g.qty); i++) {
      const description = g.qty > 1 ? `${base} ${String(i).padStart(2, "0")}` : base;
      pins.push({
        id: `${g.id}-${i}`,
        groupId: g.id, signal: g.signal, connector: g.connector,
        direction: g.direction, side: g.side,
        description, pinIndex: i, pinTotal: g.qty
      });
    }
  });
  return pins;
}

const INITIAL_LIBRARY = (SAMPLE_LIBRARY || []).map(eq => ({
  ...eq,
  notes:    eq.notes    || "",
  location: eq.location || "COMM1",
  groups: (eq.groups || []).map(g => ({
    ...g,
    direction:   g.direction   || "Input",
    description: g.description || "",
  }))
}));

// ── PinRow — exact copy of canvas BlockView PinRow ────────────────────────────
// Used in both MiniBlockPreview (scaled) and BlockPreview (full size)
function PinRow({ p, side }) {
  const color  = SIGNAL_COLORS[p.signal] || "#888";
  const isLeft = side === "left";
  return (
    <div style={{ position:"relative", height: ROW_H, display:"flex",
      alignItems:"center", flexDirection: isLeft ? "row-reverse" : "row" }}>
      {/* Connector label above the pin line */}
      <div style={{ position:"absolute",
        bottom: ROW_H / 2 + DOT_R,
        [isLeft ? "right" : "left"]: 4,
        height: 10, textAlign: isLeft ? "right" : "left" }}>
        <span style={{ fontSize:6, color, lineHeight:"10px", display:"block",
          whiteSpace:"nowrap", transform:"translateY(2px)" }}>
          {p.connector}
        </span>
      </div>
      <div style={{ width: STUB_W, height:2, background:color, flexShrink:0 }} />
      <div style={{ width: DOT_R*2, height: DOT_R*2, borderRadius:"50%",
        background:color, border:"2px solid #1a1f2e", flexShrink:0 }} />
    </div>
  );
}

// CARD_SIZE — change this one value to resize all cards uniformly
const CARD_SIZE = 200;

// ── MiniBlockPreview ─────────────────────────────────────────────────────────
// Viewport is always 190×126 px (card 200×200, title 40px, buttons 32px, border/margin 2px).
// These are hardcoded from DOM measurement — no refs, no state, no async issues.
// CARD_PREVIEW_W / H are the only values to tweak if card size changes.
const CARD_PREVIEW_W = 190;
const CARD_PREVIEW_H = 126;

function MiniBlockPreview({ eq }) {
  const pins  = expandGroups(eq.groups || []);
  const left  = pins.filter(p => p.side === "left");
  const right = pins.filter(p => p.side === "right");
  const rows  = Math.max(left.length, right.length, 1);
  const blockH = HEADER_H + rows * ROW_H + FOOTER_H;
  const blockW = PAD_W + BODY_W + PAD_W;   // 256

  const SCALE   = Math.min(1, CARD_PREVIEW_W / blockW, CARD_PREVIEW_H / blockH);
  const scaledW = blockW * SCALE;
  const scaledH = blockH * SCALE;

  // Centre offset in screen-space (post-transform pixels).
  // With transformOrigin:"top left", the element origin is its top-left corner —
  // so left/top set the final screen position directly, no division by SCALE needed.
  const offsetX = (CARD_PREVIEW_W - scaledW) / 2;
  const offsetY = (CARD_PREVIEW_H - scaledH) / 2;

  const borderColor = "#3d4663";

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <div style={{
        transform: `scale(${SCALE})`,
        transformOrigin: "top left",
        width: blockW,
        height: blockH,
        position: "absolute",
        top:  offsetY,
        left: offsetX,
      }}>
        {/* Header */}
        <div style={{
          position:"absolute", left: PAD_W, top:0, width: BODY_W, height: HEADER_H,
          background:"#2d3555", borderRadius:"6px 6px 0 0",
          borderTop:`2px solid ${borderColor}`, borderLeft:`2px solid ${borderColor}`, borderRight:`2px solid ${borderColor}`,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"4px 6px",
        }}>
          <div style={{ fontSize:10, fontWeight:600, color:"#a8d4ff", lineHeight:1.3, textAlign:"center" }}>{eq.systemName}</div>
          <div style={{ fontSize:7, color:"#7a8ab0", lineHeight:1.2 }}>{eq.manufacturer}</div>
          <div style={{ fontSize:9, fontWeight:500, color:"#c8d0e8", lineHeight:1.2, textAlign:"center" }}>{eq.model}</div>
        </div>
        {/* Body */}
        <div style={{
          position:"absolute", left: PAD_W, top: HEADER_H, width: BODY_W, height: rows * ROW_H,
          background:"#1e2433", borderLeft:`2px solid ${borderColor}`, borderRight:`2px solid ${borderColor}`,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>{left.map(p => (
              <div key={p.id} style={{ height: ROW_H, display:"flex", alignItems:"center", paddingLeft:5 }}>
                <span style={{ fontSize:8, color:"#8892a8", whiteSpace:"nowrap" }}>{p.description}</span>
              </div>
            ))}</div>
            <div>{right.map(p => (
              <div key={p.id} style={{ height: ROW_H, display:"flex", alignItems:"center", paddingRight:5 }}>
                <span style={{ fontSize:8, color:"#8892a8", whiteSpace:"nowrap" }}>{p.description}</span>
              </div>
            ))}</div>
          </div>
        </div>
        {/* Footer */}
        <div style={{
          position:"absolute", left: PAD_W, top: HEADER_H + rows * ROW_H, width: BODY_W, height: FOOTER_H,
          background:"#1e2433", borderRadius:"0 0 6px 6px",
          borderBottom:`2px solid ${borderColor}`, borderLeft:`2px solid ${borderColor}`, borderRight:`2px solid ${borderColor}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 6px",
        }}>
          <span style={{ fontSize:7, color:"#7a8ab0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>{eq.location}</span>
          {eq.wattage > 0 && <span style={{ fontSize:7, color:"#555e7a" }}>{eq.wattage}W</span>}
        </div>
        {/* Left pins */}
        <div style={{ position:"absolute", left:0, top: HEADER_H, width: PAD_W }}>
          {left.map(p => <PinRow key={p.id} p={p} side="left" />)}
        </div>
        {/* Right pins */}
        <div style={{ position:"absolute", right:0, top: HEADER_H, width: PAD_W }}>
          {right.map(p => <PinRow key={p.id} p={p} side="right" />)}
        </div>
      </div>
    </div>
  );
}

// ── BlockPreview — full-size live preview used in the editor ──────────────────
// Identical structure to MiniBlockPreview but unscaled, with connector labels visible
function BlockPreview({ eq }) {
  const pins  = expandGroups(eq.groups || []);
  const left  = pins.filter(p => p.side === "left");
  const right = pins.filter(p => p.side === "right");
  const rows  = Math.max(left.length, right.length, 1);
  const blockH = HEADER_H + rows * ROW_H + FOOTER_H;
  const blockW = PAD_W + BODY_W + PAD_W;
  const borderColor = "#3d4663";

  return (
    <div style={{ position:"relative", width: blockW, height: blockH, margin:"0 auto" }}>
      {/* Header */}
      <div style={{
        position:"absolute", left: PAD_W, top:0, width: BODY_W, height: HEADER_H,
        background:"#2d3555", borderRadius:"6px 6px 0 0",
        borderTop:`2px solid ${borderColor}`,
        borderLeft:`2px solid ${borderColor}`,
        borderRight:`2px solid ${borderColor}`,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:"4px 6px",
      }}>
        <div style={{ fontSize:10, fontWeight:600, color:"#a8d4ff", lineHeight:1.3, textAlign:"center" }}>
          {eq.systemName || "—"}
        </div>
        <div style={{ fontSize:7, color:"#7a8ab0", lineHeight:1.2 }}>{eq.manufacturer || "Manufacturer"}</div>
        <div style={{ fontSize:9, fontWeight:500, color:"#c8d0e8", lineHeight:1.2, textAlign:"center" }}>
          {eq.model || "Model"}
        </div>
      </div>

      {/* Body */}
      <div style={{
        position:"absolute", left: PAD_W, top: HEADER_H,
        width: BODY_W, height: rows * ROW_H, background:"#1e2433",
        borderLeft:`2px solid ${borderColor}`, borderRight:`2px solid ${borderColor}`,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div>
            {left.map(p => (
              <div key={p.id} style={{ height: ROW_H, display:"flex", alignItems:"center", paddingLeft:5 }}>
                <span style={{ fontSize:8, color:"#8892a8", whiteSpace:"nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
          <div>
            {right.map(p => (
              <div key={p.id} style={{ height: ROW_H, display:"flex", alignItems:"center", paddingRight:5 }}>
                <span style={{ fontSize:8, color:"#8892a8", whiteSpace:"nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position:"absolute", left: PAD_W, top: HEADER_H + rows * ROW_H,
        width: BODY_W, height: FOOTER_H, background:"#1e2433",
        borderRadius:"0 0 6px 6px",
        borderBottom:`2px solid ${borderColor}`,
        borderLeft:`2px solid ${borderColor}`,
        borderRight:`2px solid ${borderColor}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 6px",
      }}>
        <span style={{ fontSize:7, color:"#7a8ab0", overflow:"hidden",
          textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>
          {eq.location}
        </span>
        {eq.wattage > 0 && <span style={{ fontSize:7, color:"#555e7a" }}>{eq.wattage}W</span>}
      </div>

      {/* Left pin stubs */}
      <div style={{ position:"absolute", left:0, top: HEADER_H, width: PAD_W }}>
        {left.map(p => <PinRow key={p.id} p={p} side="left" />)}
      </div>

      {/* Right pin stubs */}
      <div style={{ position:"absolute", right:0, top: HEADER_H, width: PAD_W }}>
        {right.map(p => <PinRow key={p.id} p={p} side="right" />)}
      </div>
    </div>
  );
}

// ── Editor sub-components (unchanged from original BlockLibrary.jsx) ──────────

function ConnectorCombo({ value, onChange }) {
  const [input, setInput] = useState(value || "");
  const [open,  setOpen]  = useState(false);
  const filtered = CONNECTOR_TYPES.filter(c => c.toLowerCase().includes(input.toLowerCase()));
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input value={input}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Connector"
        style={{ width: "100%", fontSize: 11, padding: "2px 6px", height: 26 }} />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: 28, left: 0, right: 0, zIndex: 300,
          background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-primary)",
          borderRadius: 6, maxHeight: 150, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.12)"
        }}>
          {filtered.map(c => (
            <div key={c} onMouseDown={() => { setInput(c); onChange(c); setOpen(false); }}
              style={{ padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "var(--color-text-primary)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({ group, onChange, onDelete, onMoveToOther, side, onDragStart, onDragOver, onDrop, isDragOver }) {
  const color  = SIGNAL_COLORS[group.signal] || "#B4B2A9";
  const isLeft = side === "left";
  return (
    <div draggable onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver(); }} onDrop={onDrop}
      style={{
        borderRadius: 8, marginBottom: 6, overflow: "hidden",
        border: `0.5px solid ${isDragOver ? "var(--color-border-info)" : color + "55"}`,
        background: isDragOver ? "var(--color-background-info)" : "var(--color-background-secondary)",
        opacity: isDragOver ? 0.6 : 1, transition: "opacity 0.12s"
      }}>
      <div style={{ background: color + "22", borderBottom: `0.5px solid ${color}44`, padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--color-text-tertiary)", fontSize: 13, cursor: "grab" }}>⠿</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: color, flex: 1 }}>{group.signal} {group.qty > 1 ? `×${group.qty}` : ""}</span>
        <button onClick={onDelete} style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: 3, height: 18 }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 44px 1fr 1fr", gap: 5, padding: "7px 8px 5px" }}>
        {["Signal type","Qty","Connector","Description"].map(h => (
          <div key={h} style={{ fontSize: 9, color: "var(--color-text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{h}</div>
        ))}
        <select value={group.signal} onChange={e => onChange({ ...group, signal: e.target.value })}
          style={{ fontSize: 11, padding: "2px 4px", height: 26, width: "100%" }}>
          {SIGNAL_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="number" min={1} max={32} value={group.qty}
          onChange={e => onChange({ ...group, qty: Math.max(1, parseInt(e.target.value) || 1) })}
          style={{ fontSize: 12, padding: "2px 4px", height: 26, textAlign: "center" }} />
        <ConnectorCombo value={group.connector} onChange={val => onChange({ ...group, connector: val })} />
        <input value={group.description || ""}
          onChange={e => onChange({ ...group, description: e.target.value })}
          placeholder={group.qty > 1 ? `${group.signal} (auto-numbered)` : `${group.signal} 01`}
          style={{ fontSize: 10, padding: "2px 6px", height: 26, minWidth: 0, width: "100%" }} />
      </div>
      <div style={{ display: "flex", gap: 5, padding: "0 8px 7px", alignItems: "center" }}>
        <select value={group.direction} onChange={e => onChange({ ...group, direction: e.target.value })}
          style={{ width: "auto", fontSize: 11, padding: "2px 4px", height: 24 }}>
          {PORT_DIRECTIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        <button onClick={onMoveToOther}
          style={{ fontSize: 10, padding: "2px 8px", cursor: "pointer", color: "var(--color-text-secondary)", height: 24, whiteSpace: "nowrap" }}>
          {isLeft ? "→ Right" : "← Left"}
        </button>
      </div>
    </div>
  );
}

function AddGroupBar({ side, onAdd }) {
  return (
    <div style={{ padding: "8px 10px", borderTop: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)" }}>
      <button onClick={() => onAdd(newGroup(side))}
        style={{ width: "100%", fontSize: 12, padding: "5px 0", cursor: "pointer", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "0.5px solid var(--color-border-info)", borderRadius: 5, fontWeight: 500 }}>
        + Add connector group
      </button>
    </div>
  );
}

function SidePanel({ groups, side, onUpdate, onDelete, onMove, onAdd, onReorder }) {
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const handleDrop = (toIdx) => {
    if (dragIdx.current === null || dragIdx.current === toIdx) { setDragOver(null); return; }
    onReorder(side, dragIdx.current, toIdx);
    dragIdx.current = null; setDragOver(null);
  };
  return (
    <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "9px 12px", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{side === "left" ? "Left side" : "Right side"}</span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: 6 }}>
          {groups.length} group{groups.length !== 1 ? "s" : ""} · {groups.reduce((s, g) => s + g.qty, 0)} pins
        </span>
      </div>
      <div style={{ flex: 1, padding: 8, minHeight: 60, overflowY: "auto" }}>
        {groups.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", padding: "20px 0" }}>No connectors — add below</div>
        )}
        {groups.map((g, idx) => (
          <GroupRow key={g.id} group={g} side={side}
            isDragOver={dragOver === idx}
            onChange={updated => onUpdate(g.id, updated)}
            onDelete={() => onDelete(g.id)}
            onMoveToOther={() => onMove(g.id, side === "left" ? "right" : "left")}
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={() => { if (dragIdx.current !== idx) setDragOver(idx); }}
            onDrop={() => handleDrop(idx)}
          />
        ))}
      </div>
      <AddGroupBar side={side} onAdd={onAdd} />
    </div>
  );
}

function BlockEditor({ equipment, onSave, onCancel, manufacturers = [] }) {
  const [eq, setEq] = useState({ ...equipment, groups: equipment.groups || [] });
  const set = (key, val) => setEq(prev => ({ ...prev, [key]: val }));
  const updateGroup   = (id, g)      => setEq(prev => ({ ...prev, groups: prev.groups.map(x => x.id === id ? g : x) }));
  const deleteGroup   = (id)         => setEq(prev => ({ ...prev, groups: prev.groups.filter(x => x.id !== id) }));
  const moveGroup     = (id, toSide) => setEq(prev => ({ ...prev, groups: prev.groups.map(x => x.id === id ? { ...x, side: toSide } : x) }));
  const addGroup      = (g)          => setEq(prev => ({ ...prev, groups: [...prev.groups, g] }));
  const reorderGroups = (side, fromIdx, toIdx) => {
    setEq(prev => {
      const sg = prev.groups.filter(g => g.side === side);
      const ot = prev.groups.filter(g => g.side !== side);
      const re = [...sg]; const [mv] = re.splice(fromIdx, 1); re.splice(toIdx, 0, mv);
      const result = []; let si = 0, oi = 0;
      prev.groups.forEach(g => { if (g.side === side) result.push(re[si++]); else result.push(ot[oi++]); });
      return { ...prev, groups: result };
    });
  };
  const leftGroups  = eq.groups.filter(g => g.side === "left");
  const rightGroups = eq.groups.filter(g => g.side === "right");
  const labelStyle  = { fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 3, display: "block" };
  const applyRackPreset = (u) => {
    const preset = RACK_U_PRESETS.find(p => p.u === u);
    if (!preset) return;
    set("height", eq.unit === "mm" ? preset.mm : preset.inch);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, padding: "12px 16px", background: "var(--color-background-secondary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)" }}>
        <div><label style={labelStyle}>Manufacturer</label>
          <input value={eq.manufacturer} onChange={e => set("manufacturer", e.target.value)}
            placeholder="e.g. Samsung" list="mfr-list" autoComplete="off" />
          <datalist id="mfr-list">
            {manufacturers.filter(Boolean).map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
        <div><label style={labelStyle}>Model</label><input value={eq.model} onChange={e => set("model", e.target.value)} placeholder="e.g. QB85C" /></div>
        <div><label style={labelStyle}>System name</label><input value={eq.systemName} onChange={e => set("systemName", e.target.value)} placeholder="e.g. DIS01" /></div>
        <div><label style={labelStyle}>Category</label>
          <select value={eq.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}><label style={labelStyle}>Description / notes</label>
          <textarea value={eq.notes || ""} onChange={e => set("notes", e.target.value)}
            placeholder="Describe the equipment, special requirements, notes for the equipment list..."
            rows={3} style={{ resize: "vertical", width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13, minHeight: 60 }} />
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 16px", background: "var(--color-background-secondary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", alignItems: "end" }}>
        <div style={{ width: 80 }}><label style={labelStyle}>Width</label><input type="number" value={eq.width} onChange={e => set("width", +e.target.value)} /></div>
        <div style={{ width: 110 }}>
          <label style={labelStyle}>Height</label>
          <div style={{ display: "flex", gap: 4 }}>
            <input type="number" value={eq.height} onChange={e => set("height", +e.target.value)} style={{ flex: 1 }} />
            <select defaultValue="" onChange={e => { if (e.target.value) applyRackPreset(+e.target.value); }}
              style={{ width: 46, fontSize: 11, padding: "2px 2px" }} title="Rack U height preset">
              <option value="" disabled>U▾</option>
              {RACK_U_PRESETS.map(p => <option key={p.u} value={p.u}>{p.u}U</option>)}
            </select>
          </div>
        </div>
        <div style={{ width: 80 }}><label style={labelStyle}>Depth</label><input type="number" value={eq.depth} onChange={e => set("depth", +e.target.value)} /></div>
        <div style={{ width: 80 }}><label style={labelStyle}>Unit</label>
          <select value={eq.unit} onChange={e => set("unit", e.target.value)}>
            <option value="in">Inches</option><option value="mm">mm</option>
          </select>
        </div>
        <div style={{ width: 80 }}><label style={labelStyle}>Power (W)</label><input type="number" value={eq.wattage} onChange={e => set("wattage", +e.target.value)} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 270px 1fr", gap: 16, alignItems: "start" }}>
        <SidePanel groups={leftGroups} side="left" onUpdate={updateGroup} onDelete={deleteGroup} onMove={moveGroup} onAdd={addGroup} onReorder={reorderGroups} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textAlign: "center" }}>Block preview</div>
          <BlockPreview eq={eq} />
          <div style={{ padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
            {[...new Set((eq.groups || []).map(g => g.signal))].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: SIGNAL_COLORS[s] || "#888", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{s}</span>
              </div>
            ))}
            {(eq.groups || []).length === 0 && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>No connectors yet</span>}
          </div>
        </div>
        <SidePanel groups={rightGroups} side="right" onUpdate={updateGroup} onDelete={deleteGroup} onMove={moveGroup} onAdd={addGroup} onReorder={reorderGroups} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave(eq)} style={{ flex: 1, padding: "9px 0", cursor: "pointer", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "0.5px solid var(--color-border-info)", borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
          Save block to library
        </button>
        <button onClick={onCancel} style={{ padding: "9px 24px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function EquipmentCard({ eq, onEdit, onDelete }) {
  return (
    <div style={{
      width: CARD_SIZE, height: CARD_SIZE,
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 10,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Title row */}
      <div style={{ padding: "8px 10px 4px", flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", lineHeight: 1.2 }}>{eq.manufacturer}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.3 }}>{eq.model}</div>
      </div>

      {/* Preview viewport — fills remaining space, block scales to fit */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", margin: "0 4px" }}>
        <MiniBlockPreview eq={eq} />
      </div>

      {/* Button row */}
      <div style={{ display: "flex", gap: 5, padding: "4px 6px 6px", flexShrink: 0 }}>
        <button onClick={() => onEdit(eq)} style={{ flex: 1, fontSize: 10, padding: "3px 0", cursor: "pointer" }}>Edit</button>
        <button onClick={() => onDelete(eq.id)} style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer", background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: 5 }}>Del</button>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function LibraryApp() {
  const [library,       setLibrary]       = useState(INITIAL_LIBRARY);
  const [view,          setView]          = useState("library");
  const [editing,       setEditing]       = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState("All");
  const [filterMfr,     setFilterMfr]     = useState("All");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dirHandle,     setDirHandle]     = useState(null);
  const [dbStatus,      setDbStatus]      = useState("disconnected"); // "disconnected"|"connected"|"syncing"|"saving"|"error"

  // On mount: restore persisted directory handle, or fetch from GitHub
  useEffect(() => {
    (async () => {
      // Try FSA first (Chrome/Edge with a previously connected folder)
      if (fsaSupported) {
        const h = await loadHandle().catch(() => null);
        if (h) {
          const ok = await verifyPermission(h).catch(() => false);
          if (ok) {
            setDirHandle(h);
            setDbStatus("syncing");
            try {
              const data = await readAllBlocks(h);
              if (data.length > 0) { setLibrary(data); setDbStatus("connected"); return; }
            } catch (e) { console.error(e); }
            setDbStatus("connected");
            return;
          }
        }
      }
      // Fallback: fetch from GitHub raw URL (same source the canvas uses)
      try {
        setDbStatus("syncing");
        const data = await fetchFromUrl();
        if (data.length > 0) setLibrary(data);
        setDbStatus("disconnected");
      } catch (e) { console.error(e); setDbStatus("disconnected"); }
    })();
  }, []);

  const handlePickFolder = async () => {
    try {
      const h = await pickDirectory();
      setDirHandle(h);
      setDbStatus("syncing");
      const data = await readAllBlocks(h);
      if (data.length > 0) setLibrary(data);
      setDbStatus("connected");
    } catch (e) {
      if (e.name !== "AbortError") { console.error(e); setDbStatus("error"); }
    }
  };

  const handleSyncFromDatabase = async () => {
    if (!dirHandle) return;
    setDbStatus("syncing");
    try {
      const ok = await verifyPermission(dirHandle);
      if (!ok) { setDbStatus("error"); return; }
      const data = await readAllBlocks(dirHandle);
      if (data.length > 0) setLibrary(data);
      setDbStatus("connected");
    } catch (e) { console.error(e); setDbStatus("error"); }
  };

  const handleSave = async (eq) => {
    if (!eq.manufacturer || !eq.manufacturer.trim()) {
      alert("Please set a Manufacturer before saving.");
      return;
    }
    const updated = library.find(e => e.id === eq.id)
      ? library.map(e => e.id === eq.id ? eq : e)
      : [...library, eq];
    setLibrary(updated);
    setView("library"); setEditing(null);
    if (dirHandle) {
      setDbStatus("saving");
      try {
        const ok = await verifyPermission(dirHandle);
        if (!ok) { setDbStatus("error"); return; }
        await saveBlock(dirHandle, eq, updated);
        setDbStatus("connected");
      } catch (e) { console.error(e); setDbStatus("error"); }
    }
  };

  const handleDelete = async (id) => {
    const eq = library.find(e => e.id === id);
    if (!eq) return;
    const updated = library.filter(e => e.id !== id);
    setLibrary(updated);
    setConfirmDelete(null);
    if (dirHandle) {
      setDbStatus("saving");
      try {
        const ok = await verifyPermission(dirHandle);
        if (!ok) { setDbStatus("error"); return; }
        await deleteBlock(dirHandle, id, eq.manufacturer, library);
        setDbStatus("connected");
      } catch (e) { console.error(e); setDbStatus("error"); }
    }
  };

  const manufacturers = ["All", ...Array.from(new Set(library.map(e => e.manufacturer).filter(Boolean))).sort()];
  const filtered = library.filter(eq => {
    const q = search.toLowerCase();
    return (!q || eq.manufacturer.toLowerCase().includes(q) || eq.model.toLowerCase().includes(q) || (eq.systemName||"").toLowerCase().includes(q))
      && (filterCat === "All" || eq.category === filterCat)
      && (filterMfr === "All" || eq.manufacturer === filterMfr);
  });

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "1rem 0", color: "var(--color-text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "var(--color-background-info)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="var(--color-text-info)" strokeWidth="1.2"/>
              <line x1="0" y1="8" x2="2" y2="8" stroke="var(--color-text-info)" strokeWidth="1.2"/>
              <line x1="14" y1="8" x2="16" y2="8" stroke="var(--color-text-info)" strokeWidth="1.2"/>
              <circle cx="5" cy="8" r="1" fill="var(--color-text-info)"/>
              <circle cx="8" cy="8" r="1" fill="var(--color-text-info)"/>
              <circle cx="11" cy="8" r="1" fill="var(--color-text-info)"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 500 }}>AVFlow</span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
              {view === "library" ? "Equipment Library" : (editing?.manufacturer ? `${editing.manufacturer} ${editing.model}` : "New block")}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Status dot */}
          {fsaSupported && (
            <div title={dbStatus} style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: dbStatus === "connected" ? "#1D9E75"
                        : dbStatus === "syncing" || dbStatus === "saving" ? "#EF9F27"
                        : dbStatus === "error"   ? "#E24B4A"
                        : "#555e7a",
            }} />
          )}
          {/* Folder button — only on FSA-capable browsers */}
          {fsaSupported && (
            <button onClick={handlePickFolder} style={{ fontSize: 13, padding: "7px 16px", cursor: "pointer" }}>
              {dirHandle ? "⌂ Change folder" : "⌂ Connect database folder"}
            </button>
          )}
          {view === "editor" && <button onClick={() => { setEditing(null); setView("library"); }} style={{ fontSize: 13, padding: "7px 16px", cursor: "pointer" }}>← Back</button>}
          {view === "library" && <button onClick={() => { setEditing(defaultNewEquipment()); setView("editor"); }} style={{ fontSize: 13, padding: "7px 16px", cursor: "pointer", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "0.5px solid var(--color-border-info)", borderRadius: 6, fontWeight: 500 }}>+ New block</button>}
        </div>
      </div>

      {view === "library" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search model, system name..." style={{ flex: 1 }} />
            <select value={filterMfr} onChange={e => setFilterMfr(e.target.value)} style={{ width: 160 }}>
              {manufacturers.map(m => <option key={m} value={m}>{m === "All" ? "All manufacturers" : m}</option>)}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160 }}>
              <option value="All">All categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, fontSize: 12, color: "var(--color-text-secondary)" }}>
            <span style={{ background: "var(--color-background-secondary)", borderRadius: 4, padding: "3px 10px" }}>{filtered.length} blocks</span>
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>
              No blocks found — <button onClick={() => { setEditing(defaultNewEquipment()); setView("editor"); }} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", fontSize: 14, padding: 0 }}>create your first block</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 200px)", gap: 12, alignItems: "stretch" }}>
            {filtered.map(eq => <EquipmentCard key={eq.id} eq={eq}
              onEdit={eq => { setEditing(eq); setView("editor"); }}
              onDelete={id => setConfirmDelete(library.find(e => e.id === id))} />)}
          </div>
        </>
      )}
      {view === "editor" && editing && <BlockEditor equipment={editing} onSave={handleSave} onCancel={() => { setEditing(null); setView("library"); }} manufacturers={[...new Set(library.map(e => e.manufacturer).filter(Boolean))].sort()} />}

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 500,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 12,
            padding: "24px 28px",
            width: 340,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Delete block?</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
              <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
                {confirmDelete.manufacturer} {confirmDelete.model}
              </span>
              {" "}will be permanently removed from the library.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: "7px 18px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}>
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                style={{
                  padding: "7px 18px", fontSize: 13, cursor: "pointer", borderRadius: 6, fontWeight: 500,
                  background: "var(--color-background-danger)",
                  color: "var(--color-text-danger)",
                  border: "0.5px solid var(--color-border-danger)",
                }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
