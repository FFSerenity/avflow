import { useState, useRef } from "react";

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

const PORT_DIRECTIONS = ["Input","Output","Bidirectional"];
const CATEGORIES = ["Display","Video Processing","Audio","Control","Network","Power","Camera","Microphone","Laptop/PC","Other"];

const RACK_U_PRESETS = [
  {u:1,inch:1.75,mm:44.45},{u:2,inch:3.5,mm:88.9},{u:3,inch:5.25,mm:133.35},
  {u:4,inch:7,mm:177.8},{u:5,inch:8.75,mm:222.25},{u:6,inch:10.5,mm:266.7},
  {u:8,inch:14,mm:355.6},{u:10,inch:17.5,mm:444.5},{u:12,inch:21,mm:533.4},
  {u:14,inch:24.5,mm:622.3},{u:16,inch:28,mm:711.2},
];

// A "group" = one editor row, expands to `qty` pins on the block
// { id, signal, qty, connector, direction, side }
// Descriptions auto-generated as `signal 01`, `signal 02`, etc.

const newGroup = (side) => ({
  id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  signal: "HDMI", qty: 1, connector: "HDMI Type A",
  direction: "Input", side, description: ""
});

const defaultNewEquipment = () => ({
  id: `eq-${Date.now()}`, manufacturer: "", model: "", category: "Other",
  width: 17, height: 1.75, depth: 8, unit: "in", wattage: 0,
  systemName: "", location: "", groups: []
});

// Expand groups into individual pin descriptors for the block preview
function expandGroups(groups) {
  const pins = [];
  groups.forEach(g => {
    // Use group.description as base if set, else fall back to signal name
    const base = (g.description && g.description.trim()) ? g.description.trim() : g.signal;
    for (let i = 1; i <= Math.max(1, g.qty); i++) {
      // If qty > 1, append padded number to base; if qty === 1, use base as-is
      const description = g.qty > 1 ? `${base} ${String(i).padStart(2, "0")}` : base;
      pins.push({
        groupId: g.id, signal: g.signal, connector: g.connector,
        direction: g.direction, side: g.side,
        description, pinIndex: i, pinTotal: g.qty
      });
    }
  });
  return pins;
}

const INITIAL_LIBRARY = [
  {
    id:"eq-001", manufacturer:"Samsung", model:"QB85C", category:"Display", width:75.6, height:44.3, depth:2.5, unit:"in", wattage:300,
    systemName:"DIS01", location:"J1.01 (FRONT WALL)",
    groups:[
      {id:"g1", signal:"HDMI",      qty:3, connector:"HDMI Type A",       direction:"Input",         side:"left"},
      {id:"g2", signal:"USB-A",     qty:2, connector:"USB Type-A",         direction:"Input",         side:"left"},
      {id:"g3", signal:"RS-232",    qty:1, connector:"DB9 (RS-232)",        direction:"Bidirectional", side:"right"},
      {id:"g4", signal:"RJ45 LAN",  qty:1, connector:"RJ45",               direction:"Bidirectional", side:"right"},
      {id:"g5", signal:"IR",        qty:1, connector:"TRS 3.5mm",           direction:"Input",         side:"right"},
      {id:"g6", signal:"IEC Power", qty:1, connector:"IEC 60320 C13",       direction:"Input",         side:"right"},
    ]
  },
  {
    id:"eq-002", manufacturer:"Crestron", model:"HD-TXC-4KZ-101", category:"Video Processing", width:17, height:1.75, depth:7, unit:"in", wattage:60,
    systemName:"HDTX01", location:"RACK01, Unit 12",
    groups:[
      {id:"g1", signal:"HDMI",    qty:1, connector:"HDMI Type A",      direction:"Input",         side:"left"},
      {id:"g2", signal:"IR",      qty:2, connector:"TRS 3.5mm",         direction:"Input",         side:"left"},
      {id:"g3", signal:"RS-232",  qty:1, connector:"Phoenix 3-pin",     direction:"Bidirectional", side:"left"},
      {id:"g4", signal:"DC Barrel",qty:1,connector:"DC Barrel 5.5/2.1mm",direction:"Input",        side:"right"},
      {id:"g5", signal:"RJ45 DM", qty:1, connector:"RJ45",              direction:"Output",        side:"right"},
    ]
  },
  {
    id:"eq-003", manufacturer:"Biamp", model:"DESONO C-IC6", category:"Audio", width:8.27, height:8.27, depth:3.5, unit:"in", wattage:60,
    systemName:"CSPK01", location:"CEILING",
    groups:[
      {id:"g1", signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left"},
      {id:"g2", signal:"Phoenix 2-pin",qty:1,connector:"Phoenix 2-pin",  direction:"Input",  side:"left"},
      {id:"g3", signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Output", side:"right"},
      {id:"g4", signal:"Phoenix 2-pin",qty:1,connector:"Phoenix 2-pin",  direction:"Output", side:"right"},
    ]
  }
];

// Connector combo input
function ConnectorCombo({ value, onChange }) {
  const [input, setInput] = useState(value || "");
  const [open, setOpen] = useState(false);
  const filtered = CONNECTOR_TYPES.filter(c => c.toLowerCase().includes(input.toLowerCase()));
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input value={input}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Connector" style={{ width: "100%", fontSize: 11, padding: "2px 6px", height: 26 }} />
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

// One editor row = one connector group
function GroupRow({ group, onChange, onDelete, onMoveToOther, side, onDragStart, onDragOver, onDrop, isDragOver }) {
  const color = SIGNAL_COLORS[group.signal] || "#B4B2A9";
  const isLeft = side === "left";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      style={{
        borderRadius: 8, marginBottom: 6, overflow: "hidden",
        border: `0.5px solid ${isDragOver ? "var(--color-border-info)" : color + "55"}`,
        background: isDragOver ? "var(--color-background-info)" : "var(--color-background-secondary)",
        opacity: isDragOver ? 0.6 : 1, transition: "opacity 0.12s"
      }}
    >
      {/* Colored header strip */}
      <div style={{ background: color + "22", borderBottom: `0.5px solid ${color}44`, padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--color-text-tertiary)", fontSize: 13, cursor: "grab" }}>⠿</span>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: color, flex: 1 }}>{group.signal} {group.qty > 1 ? `×${group.qty}` : ""}</span>
        <button onClick={onDelete} style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer", background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: 3, height: 18 }}>✕</button>
      </div>

      {/* 4-column grid: Signal | Qty | Connector | Description */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 44px 1fr 1fr", gap: 5, padding: "7px 8px 5px" }}>
        {/* Column headers */}
        {["Signal type","Qty","Connector","Description"].map(h => (
          <div key={h} style={{ fontSize: 9, color: "var(--color-text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{h}</div>
        ))}

        {/* Signal type */}
        <select value={group.signal}
          onChange={e => onChange({ ...group, signal: e.target.value })}
          style={{ fontSize: 11, padding: "2px 4px", height: 26, width: "100%" }}>
          {SIGNAL_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Quantity */}
        <input type="number" min={1} max={32} value={group.qty}
          onChange={e => onChange({ ...group, qty: Math.max(1, parseInt(e.target.value) || 1) })}
          style={{ fontSize: 12, padding: "2px 4px", height: 26, textAlign: "center" }} />

        {/* Connector combo */}
        <ConnectorCombo value={group.connector} onChange={val => onChange({ ...group, connector: val })} />

        {/* Description — editable base label; numbers appended automatically per pin when qty>1 */}
        <input
          value={group.description || ""}
          onChange={e => onChange({ ...group, description: e.target.value })}
          placeholder={group.qty > 1 ? `${group.signal} (auto-numbered)` : `${group.signal} 01`}
          style={{ fontSize: 10, padding: "2px 6px", height: 26, minWidth: 0, width: "100%" }}
        />
      </div>

      {/* Direction + move */}
      <div style={{ display: "flex", gap: 5, padding: "0 8px 7px", alignItems: "center" }}>
        <select value={group.direction}
          onChange={e => onChange({ ...group, direction: e.target.value })}
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

// Add group bar at bottom of panel
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

// Side panel with drag reorder
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
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", padding: "20px 0" }}>
            No connectors — add below
          </div>
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

// Block preview — renders expanded pins with connector label outside, description inside
function BlockPreview({ eq }) {
  const allPins = expandGroups(eq.groups || []);
  const leftPins = allPins.filter(p => p.side === "left");
  const rightPins = allPins.filter(p => p.side === "right");
  const rowH = 18;
  const labelH = 10;
  const pinH = rowH + labelH;
  const headerH = 46;
  const footerH = 20;
  const maxRows = Math.max(leftPins.length, rightPins.length, 2);
  const blockH = Math.max(90, maxRows * pinH + headerH + footerH);

  const PinStub = ({ pin, side }) => {
    const color = SIGNAL_COLORS[pin.signal] || "#888";
    const isLeft = side === "left";
    return (
      <div style={{ width: 70, height: pinH, display: "flex", flexDirection: "column", alignItems: isLeft ? "flex-end" : "flex-start" }}>
        {/* Spacer pushes label+pin to bottom */}
        <div style={{ flex: 1 }} />
        {/* Connector label — translateY nudges it flush against the pin line */}
        <div style={{ overflow: "hidden", height: 9, width: "100%", flexShrink: 0 }}>
          <span style={{
            fontSize: 7, color: color, whiteSpace: "nowrap",
            width: "100%", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: "9px", display: "block",
            textAlign: isLeft ? "right" : "left",
            transform: "translateY(2px)"
          }}>{pin.connector}</span>
        </div>
        {/* Pin line + dot */}
        <div style={{ display: "flex", alignItems: "center", flexDirection: isLeft ? "row" : "row-reverse", height: rowH, marginTop: 0 }}>
          <div style={{ width: 14, height: 2, background: color }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, border: "2px solid var(--color-background-primary)", [isLeft ? "marginLeft" : "marginRight"]: -1 }} />
        </div>
      </div>
    );
  };

  // Header height so we can offset description rows to match pin rows

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%", paddingTop: 4, overflow: "hidden" }}>
      {/* Left stubs — padded top to skip header, then one pinH per pin */}
      <div style={{ display: "flex", flexDirection: "column", paddingTop: headerH, flexShrink: 0 }}>
        {leftPins.map((p, i) => <PinStub key={i} pin={p} side="left" />)}
      </div>

      {/* Block body */}
      <div style={{ flex: 1, background: "var(--color-background-secondary)", border: "2px solid var(--color-border-primary)", borderRadius: 6, minHeight: blockH, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header — fixed height matches headerH */}
        <div style={{ background: "var(--color-border-primary)", height: headerH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {eq.systemName && <div style={{ fontSize: 9, color: "var(--color-background-primary)", opacity: 0.9, fontWeight: 500 }}>{eq.systemName}</div>}
          <div style={{ fontSize: 9, color: "var(--color-background-primary)", opacity: 0.75 }}>{eq.manufacturer || "Manufacturer"}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-background-primary)" }}>{eq.model || "Model"}</div>
        </div>

        {/* Description labels — each row is exactly pinH tall, matching stub rows */}
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {leftPins.map((p, i) => (
              <div key={i} style={{ height: pinH, display: "flex", alignItems: "center", paddingLeft: 5 }}>
                <span style={{ fontSize: 8, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rightPins.map((p, i) => (
              <div key={i} style={{ height: pinH, display: "flex", alignItems: "center", paddingRight: 5 }}>
                <span style={{ fontSize: 8, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", height: footerH, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 8px", fontSize: 9, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
          {eq.wattage > 0 && <span>{eq.wattage}W</span>}
        </div>
      </div>

      {/* Right stubs — same paddingTop as left */}
      <div style={{ display: "flex", flexDirection: "column", paddingTop: headerH, flexShrink: 0 }}>
        {rightPins.map((p, i) => <PinStub key={i} pin={p} side="right" />)}
      </div>
    </div>
  );
}

function BlockEditor({ equipment, onSave, onCancel }) {
  const [eq, setEq] = useState({ ...equipment, groups: equipment.groups || [] });
  const set = (key, val) => setEq(prev => ({ ...prev, [key]: val }));

  const updateGroup = (id, g) => setEq(prev => ({ ...prev, groups: prev.groups.map(x => x.id === id ? g : x) }));
  const deleteGroup = (id) => setEq(prev => ({ ...prev, groups: prev.groups.filter(x => x.id !== id) }));
  const moveGroup = (id, toSide) => setEq(prev => ({ ...prev, groups: prev.groups.map(x => x.id === id ? { ...x, side: toSide } : x) }));
  const addGroup = (g) => setEq(prev => ({ ...prev, groups: [...prev.groups, g] }));

  const reorderGroups = (side, fromIdx, toIdx) => {
    setEq(prev => {
      const sideGroups = prev.groups.filter(g => g.side === side);
      const others = prev.groups.filter(g => g.side !== side);
      const reordered = [...sideGroups];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const result = [];
      let si = 0, oi = 0;
      prev.groups.forEach(g => {
        if (g.side === side) result.push(reordered[si++]);
        else result.push(others[oi++]);
      });
      return { ...prev, groups: result };
    });
  };

  const leftGroups = eq.groups.filter(g => g.side === "left");
  const rightGroups = eq.groups.filter(g => g.side === "right");
  const labelStyle = { fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 3, display: "block" };

  const applyRackPreset = (u) => {
    const preset = RACK_U_PRESETS.find(p => p.u === u);
    if (!preset) return;
    set("height", eq.unit === "mm" ? preset.mm : preset.inch);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr", gap: 10, padding: "12px 16px", background: "var(--color-background-secondary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)" }}>
        <div><label style={labelStyle}>Manufacturer</label><input value={eq.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="e.g. Samsung" /></div>
        <div><label style={labelStyle}>Model</label><input value={eq.model} onChange={e => set("model", e.target.value)} placeholder="e.g. QB85C" /></div>
        <div><label style={labelStyle}>System name</label><input value={eq.systemName} onChange={e => set("systemName", e.target.value)} placeholder="e.g. DIS01" /></div>
        <div><label style={labelStyle}>Category</label>
          <select value={eq.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Location</label><input value={eq.location} onChange={e => set("location", e.target.value)} placeholder="e.g. J1.01 (FRONT WALL)" /></div>
      </div>

      {/* Dimensions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 16px", background: "var(--color-background-secondary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", alignItems: "end" }}>
        <div style={{ width: 80 }}><label style={labelStyle}>Width</label><input type="number" value={eq.width} onChange={e => set("width", +e.target.value)} /></div>
        <div style={{ width: 110 }}>
          <label style={labelStyle}>Height</label>
          <div style={{ display: "flex", gap: 4 }}>
            <input type="number" value={eq.height} onChange={e => set("height", +e.target.value)} style={{ flex: 1 }} />
            <select
                defaultValue=""
                onChange={e => { if (e.target.value) applyRackPreset(+e.target.value); }}
                style={{ width: 46, fontSize: 11, padding: "2px 2px" }}
                title="Rack U height preset">
                <option value="" disabled>U▾</option>
                {RACK_U_PRESETS.map(p => <option key={p.u} value={p.u}>{p.u}U</option>)}
              </select>
          </div>
        </div>
        <div style={{ width: 80 }}><label style={labelStyle}>Depth</label><input type="number" value={eq.depth} onChange={e => set("depth", +e.target.value)} /></div>
        <div style={{ width: 80 }}><label style={labelStyle}>Unit</label>
          <select value={eq.unit} onChange={e => set("unit", e.target.value)}>
            <option value="in">Inches</option>
            <option value="mm">mm</option>
          </select>
        </div>
        <div style={{ width: 80 }}><label style={labelStyle}>Power (W)</label><input type="number" value={eq.wattage} onChange={e => set("wattage", +e.target.value)} /></div>

      </div>

      {/* Three columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 270px 1fr", gap: 16, alignItems: "start" }}>
        <SidePanel groups={leftGroups} side="left"
          onUpdate={updateGroup} onDelete={deleteGroup} onMove={moveGroup}
          onAdd={addGroup} onReorder={reorderGroups} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textAlign: "center" }}>Block preview</div>
          <BlockPreview eq={eq} />
          {/* Signal legend */}
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

        <SidePanel groups={rightGroups} side="right"
          onUpdate={updateGroup} onDelete={deleteGroup} onMove={moveGroup}
          onAdd={addGroup} onReorder={reorderGroups} />
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave(eq)} style={{ flex: 1, padding: "9px 0", cursor: "pointer", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "0.5px solid var(--color-border-info)", borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
          Save block to library
        </button>
        <button onClick={onCancel} style={{ padding: "9px 24px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function MiniBlockPreview({ eq }) {
  const allPins = expandGroups(eq.groups || []);
  const leftPins = allPins.filter(p => p.side === "left");
  const rightPins = allPins.filter(p => p.side === "right");
  const pinH = 14;
  const headerH = 28;
  const footerH = 14;
  const blockH = Math.max(50, Math.max(leftPins.length, rightPins.length, 1) * pinH + headerH + footerH);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
      {/* Left stubs */}
      <div style={{ display: "flex", flexDirection: "column", paddingTop: headerH, flexShrink: 0 }}>
        {leftPins.map((p, i) => {
          const color = SIGNAL_COLORS[p.signal] || "#888";
          return (
            <div key={i} style={{ height: pinH, display: "flex", alignItems: "center" }}>
              <div style={{ width: 8, height: 1.5, background: color }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, border: "1.5px solid var(--color-background-primary)", marginLeft: -1 }} />
            </div>
          );
        })}
      </div>

      {/* Block body */}
      <div style={{ flex: 1, background: "var(--color-background-secondary)", border: "1.5px solid var(--color-border-primary)", borderRadius: 4, minHeight: blockH, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "var(--color-border-primary)", height: headerH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "2px 4px" }}>
          {eq.systemName && <div style={{ fontSize: 7, color: "var(--color-background-primary)", opacity: 0.9, fontWeight: 500, lineHeight: 1 }}>{eq.systemName}</div>}
          <div style={{ fontSize: 7, color: "var(--color-background-primary)", opacity: 0.7, lineHeight: 1.2 }}>{eq.manufacturer}</div>
          <div style={{ fontSize: 9, fontWeight: 500, color: "var(--color-background-primary)", lineHeight: 1.2, textAlign: "center" }}>{eq.model}</div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {leftPins.map((p, i) => (
              <div key={i} style={{ height: pinH, display: "flex", alignItems: "center", paddingLeft: 3 }}>
                <span style={{ fontSize: 6, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rightPins.map((p, i) => (
              <div key={i} style={{ height: pinH, display: "flex", alignItems: "center", paddingRight: 3 }}>
                <span style={{ fontSize: 6, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{p.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", height: footerH, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 4px", fontSize: 7, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
          {eq.wattage > 0 && <span>{eq.wattage}W</span>}
        </div>
      </div>

      {/* Right stubs */}
      <div style={{ display: "flex", flexDirection: "column", paddingTop: headerH, flexShrink: 0 }}>
        {rightPins.map((p, i) => {
          const color = SIGNAL_COLORS[p.signal] || "#888";
          return (
            <div key={i} style={{ height: pinH, display: "flex", alignItems: "center" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, border: "1.5px solid var(--color-background-primary)", marginRight: -1 }} />
              <div style={{ width: 8, height: 1.5, background: color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EquipmentCard({ eq, onEdit, onDelete }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Header — large manufacturer + model */}
      <div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{eq.manufacturer}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)" }}>{eq.model}</div>
      </div>
      {/* Mini block preview */}
      <div style={{ flex: 1 }}>
        <MiniBlockPreview eq={eq} />
      </div>
      {/* Buttons always at bottom */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={() => onEdit(eq)} style={{ flex: 1, fontSize: 12, padding: "5px 0", cursor: "pointer" }}>Edit block</button>
        <button onClick={() => onDelete(eq.id)} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: 6 }}>Delete</button>
      </div>
    </div>
  );
}

export default function AVFlowLibrary() {
  const [library, setLibrary] = useState(INITIAL_LIBRARY);
  const [view, setView] = useState("library");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterMfr, setFilterMfr] = useState("All");

  const manufacturers = ["All", ...Array.from(new Set(library.map(e => e.manufacturer).filter(Boolean))).sort()];
  const filtered = library.filter(eq => {
    const q = search.toLowerCase();
    return (!q || eq.manufacturer.toLowerCase().includes(q) || eq.model.toLowerCase().includes(q) || eq.systemName.toLowerCase().includes(q))
      && (filterCat === "All" || eq.category === filterCat)
      && (filterMfr === "All" || eq.manufacturer === filterMfr);
  });

  const handleSave = (eq) => {
    setLibrary(prev => prev.find(e => e.id === eq.id) ? prev.map(e => e.id === eq.id ? eq : e) : [...prev, eq]);
    setView("library"); setEditing(null);
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "1rem 0", color: "var(--color-text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "var(--color-background-info)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" stroke="var(--color-text-info)" strokeWidth="1.2"/><line x1="0" y1="8" x2="2" y2="8" stroke="var(--color-text-info)" strokeWidth="1.2"/><line x1="14" y1="8" x2="16" y2="8" stroke="var(--color-text-info)" strokeWidth="1.2"/><circle cx="5" cy="8" r="1" fill="var(--color-text-info)"/><circle cx="8" cy="8" r="1" fill="var(--color-text-info)"/><circle cx="11" cy="8" r="1" fill="var(--color-text-info)"/></svg>
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 500 }}>AVFlow</span>
            <span style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
              {view === "library" ? "Equipment Library" : (editing?.manufacturer ? `${editing.manufacturer} ${editing.model}` : "New block")}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
            <span style={{ background: "var(--color-background-secondary)", borderRadius: 4, padding: "3px 10px" }}>{library.reduce((s, e) => s + e.wattage, 0)}W total</span>

          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>
              No blocks found — <button onClick={() => { setEditing(defaultNewEquipment()); setView("editor"); }} style={{ background: "none", border: "none", color: "var(--color-text-info)", cursor: "pointer", fontSize: 14, padding: 0 }}>create your first block</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, alignItems: "stretch" }}>
            {filtered.map(eq => <EquipmentCard key={eq.id} eq={eq}
              onEdit={eq => { setEditing(eq); setView("editor"); }}
              onDelete={id => setLibrary(prev => prev.filter(e => e.id !== id))} />)}
          </div>
        </>
      )}
      {view === "editor" && editing && <BlockEditor equipment={editing} onSave={handleSave} onCancel={() => { setEditing(null); setView("library"); }} />}
    </div>
  );
}
