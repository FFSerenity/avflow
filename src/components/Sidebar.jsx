import { useState } from "react";
import { SIGNAL_COLORS, ROW_H, HEADER_H, FOOTER_H, BODY_W, PAD_W, STUB_W, DOT_R } from "../constants.js";
import { expandGroups, getPrefix, getNextSysName } from "../geometry.js";

const SAMPLE_LIBRARY = [
  { id:"eq-001", manufacturer:"Samsung", model:"QB85C", category:"Display",
    comment:"85\" Crystal UHD Signage",
    width:74.97, height:42.73, depth:1.12, unit:"in", wattage:300,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1", signal:"HDMI",       qty:2, connector:"HDMI Type A",    direction:"Input",  side:"left",  description:"HDMI"},
      {id:"g2", signal:"HDMI",       qty:1, connector:"HDMI Type A",    direction:"Input",  side:"left",  description:"HDMI 3 ARC"},
      {id:"g3", signal:"USB-A",      qty:2, connector:"USB Type-A",     direction:"Input",  side:"left",  description:"USB 2.0"},
      {id:"g4", signal:"RS-232",     qty:1, connector:"TRS 3.5mm",      direction:"Input",  side:"left",  description:"RS-232C"},
      {id:"g5", signal:"RJ45 LAN",   qty:1, connector:"RJ45",           direction:"Input",  side:"left",  description:"LAN"},
      {id:"g6", signal:"IR",         qty:1, connector:"TRS 3.5mm",      direction:"Input",  side:"left",  description:"IR"},
      {id:"g7", signal:"IEC Power",  qty:1, connector:"IEC 60320 C13",  direction:"Input",  side:"left",  description:"POWER"},
      {id:"g8", signal:"3.5mm Stereo",qty:1,connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"STEREO"},
      {id:"g9", signal:"RS-232",     qty:1, connector:"TRS 3.5mm",      direction:"Output", side:"right", description:"RS-232C"},
    ]},

  { id:"eq-002", manufacturer:"Samsung", model:"QM55R", category:"Display",
    comment:"55\" Commercial Display",
    width:48.6, height:27.8, depth:1.8, unit:"in", wattage:143,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",  signal:"HDMI",        qty:2, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI IN"},
      {id:"g2",  signal:"DisplayPort", qty:1, connector:"DisplayPort",   direction:"Input",  side:"left",  description:"DP IN"},
      {id:"g3",  signal:"DVI",         qty:1, connector:"DVI-I",         direction:"Input",  side:"left",  description:"DVI IN"},
      {id:"g4",  signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"STEREO"},
      {id:"g5",  signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"RS-232C"},
      {id:"g6",  signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left",  description:"LAN"},
      {id:"g7",  signal:"USB-A",       qty:2, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB"},
      {id:"g8",  signal:"IEC Power",   qty:1, connector:"IEC 60320 C13", direction:"Input",  side:"left",  description:"POWER"},
      {id:"g9",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Output", side:"right", description:"HDMI OUT"},
      {id:"g10", signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"STEREO"},
      {id:"g11", signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"RS-232C"},
      {id:"g12", signal:"IR",          qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"IR"},
    ]},

  { id:"eq-003", manufacturer:"Samsung", model:"QM75R", category:"Display",
    comment:"75\" Commercial Display",
    width:66.18, height:37.8, depth:1.96, unit:"in", wattage:231,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",  signal:"HDMI",        qty:2, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI IN"},
      {id:"g2",  signal:"DisplayPort", qty:1, connector:"DisplayPort",   direction:"Input",  side:"left",  description:"DP IN"},
      {id:"g3",  signal:"DVI",         qty:1, connector:"DVI-I",         direction:"Input",  side:"left",  description:"DVI IN"},
      {id:"g4",  signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"STEREO"},
      {id:"g5",  signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"RS-232C"},
      {id:"g6",  signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left",  description:"LAN"},
      {id:"g7",  signal:"USB-A",       qty:2, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB"},
      {id:"g8",  signal:"IEC Power",   qty:1, connector:"IEC 60320 C13", direction:"Input",  side:"left",  description:"POWER"},
      {id:"g9",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Output", side:"right", description:"HDMI OUT"},
      {id:"g10", signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"STEREO"},
      {id:"g11", signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"RS-232C"},
    ]},

  { id:"eq-004", manufacturer:"Samsung", model:"QM43B-T", category:"Display",
    comment:"43\" Touch Display 24/7",
    width:38.8, height:23.0, depth:2.2, unit:"in", wattage:110,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",  signal:"HDMI",        qty:3, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI"},
      {id:"g2",  signal:"DisplayPort", qty:1, connector:"DisplayPort",   direction:"Input",  side:"left",  description:"DP"},
      {id:"g3",  signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"STEREO"},
      {id:"g4",  signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"RS-232C"},
      {id:"g5",  signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left",  description:"LAN"},
      {id:"g6",  signal:"USB-A",       qty:2, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB"},
      {id:"g7",  signal:"USB-B",       qty:1, connector:"USB Type-B",    direction:"Input",  side:"left",  description:"TOUCH OUT"},
      {id:"g8",  signal:"USB-B",       qty:1, connector:"USB Type-B",    direction:"Input",  side:"left",  description:"TOUCH PC"},
      {id:"g9",  signal:"IEC Power",   qty:1, connector:"IEC 60320 C13", direction:"Input",  side:"left",  description:"POWER"},
      {id:"g10", signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Output", side:"right", description:"HDMI"},
      {id:"g11", signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"STEREO"},
      {id:"g12", signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"RS-232C"},
    ]},

  { id:"eq-005", manufacturer:"Samsung", model:"QB65C", category:"Display",
    comment:"65\" Crystal UHD Signage",
    width:57.35, height:32.75, depth:1.12, unit:"in", wattage:150,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI 1"},
      {id:"g2",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI 2"},
      {id:"g3",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI 3 ARC"},
      {id:"g4",  signal:"USB-A",       qty:2, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB 2.0"},
      {id:"g5",  signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"RS-232C"},
      {id:"g6",  signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left",  description:"LAN"},
      {id:"g7",  signal:"IR",          qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"IR"},
      {id:"g8",  signal:"IEC Power",   qty:1, connector:"IEC 60320 C13", direction:"Input",  side:"left",  description:"POWER"},
      {id:"g9",  signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"STEREO"},
      {id:"g10", signal:"RS-232",      qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"RS-232C"},
    ]},

  { id:"eq-006", manufacturer:"Samsung", model:"WA86D", category:"Display",
    comment:"86\" Interactive Touch Display",
    width:75.8, height:44.6, depth:3.8, unit:"in", wattage:486,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI-IN 01"},
      {id:"g2",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI-IN 02"},
      {id:"g3",  signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Input",  side:"left",  description:"HDMI-IN 03"},
      {id:"g4",  signal:"USB-B",       qty:1, connector:"USB Type-B",    direction:"Input",  side:"left",  description:"TOUCH 01"},
      {id:"g5",  signal:"USB-B",       qty:1, connector:"USB Type-B",    direction:"Input",  side:"left",  description:"TOUCH 03"},
      {id:"g6",  signal:"USB-C",       qty:1, connector:"USB Type-C",    direction:"Input",  side:"left",  description:"USB-C"},
      {id:"g7",  signal:"USB-A",       qty:1, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB 2.0"},
      {id:"g8",  signal:"USB-A",       qty:3, connector:"USB Type-A",    direction:"Input",  side:"left",  description:"USB 3.0"},
      {id:"g9",  signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"LINE-IN"},
      {id:"g10", signal:"RS-232",      qty:1, connector:"DB-9",          direction:"Input",  side:"left",  description:"RS-232-IN"},
      {id:"g11", signal:"IR",          qty:1, connector:"TRS 3.5mm",     direction:"Input",  side:"left",  description:"IR-IN"},
      {id:"g12", signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Input",  side:"left",  description:"LAN"},
      {id:"g13", signal:"IEC Power",   qty:1, connector:"IEC 60320 C13", direction:"Input",  side:"left",  description:"PWR"},
      {id:"g14", signal:"HDMI",        qty:1, connector:"HDMI Type A",   direction:"Output", side:"right", description:"HDMI-OUT"},
      {id:"g15", signal:"3.5mm Stereo",qty:1, connector:"TRS 3.5mm",     direction:"Output", side:"right", description:"LINE-OUT"},
      {id:"g16", signal:"RS-232",      qty:1, connector:"DB-9",          direction:"Output", side:"right", description:"RS-232 OUT"},
      {id:"g17", signal:"RJ45 LAN",    qty:1, connector:"RJ45",          direction:"Output", side:"right", description:"LAN LP"},
    ]},
];


function TinyBlock({ eq }) {
  const pins   = expandGroups(eq.groups || []);
  const left   = pins.filter(p => p.side === "left");
  const right  = pins.filter(p => p.side === "right");
  const rows   = Math.max(left.length, right.length, 1);
  const bH     = HEADER_H + rows * ROW_H + FOOTER_H;
  const bW     = PAD_W + BODY_W + PAD_W;
  const SCALE  = 0.28;
  return (
    <div style={{ position:"absolute", top:8, right:8,
      width: bW * SCALE, height: bH * SCALE, overflow:"hidden",
      borderRadius:2, opacity:0.85, pointerEvents:"none" }}>
      <div style={{ transform:`scale(${SCALE})`, transformOrigin:"top left",
        width: bW, height: bH, position:"absolute", top:0, left:0 }}>
        <div style={{ position:"absolute", left:PAD_W, top:0, width:BODY_W, height:HEADER_H,
          background:"#2d3555", borderRadius:"6px 6px 0 0", border:"2px solid #3d4663",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          {eq.systemName && <div style={{ fontSize:10, fontWeight:600, color:"#a8d4ff" }}>{eq.systemName}</div>}
          <div style={{ fontSize:8, color:"#7a8ab0" }}>{eq.manufacturer}</div>
          <div style={{ fontSize:9, fontWeight:500, color:"#c8d0e8", textAlign:"center", padding:"0 4px" }}>{eq.model}</div>
        </div>
        <div style={{ position:"absolute", left:PAD_W, top:HEADER_H, width:BODY_W, height:rows*ROW_H,
          background:"#1e2433", borderLeft:"2px solid #3d4663", borderRight:"2px solid #3d4663" }} />
        <div style={{ position:"absolute", left:PAD_W, top:HEADER_H+rows*ROW_H, width:BODY_W, height:FOOTER_H,
          background:"#1e2433", borderRadius:"0 0 6px 6px", border:"2px solid #3d4663", borderTop:"none" }} />
        {left.map((p, i) => {
          const color = SIGNAL_COLORS[p.signal]||"#888";
          const y = HEADER_H + i*ROW_H + ROW_H/2;
          return (
            <div key={p.id} style={{ position:"absolute", left:0, top:y-1, display:"flex", alignItems:"center" }}>
              <div style={{ width:DOT_R*2, height:DOT_R*2, borderRadius:"50%", background:color, border:"2px solid #1a1f2e" }} />
              <div style={{ width:STUB_W, height:2, background:color }} />
            </div>
          );
        })}
        {right.map((p, i) => {
          const color = SIGNAL_COLORS[p.signal]||"#888";
          const y = HEADER_H + i*ROW_H + ROW_H/2;
          return (
            <div key={p.id} style={{ position:"absolute", right:0, top:y-1, display:"flex", alignItems:"center", flexDirection:"row-reverse" }}>
              <div style={{ width:DOT_R*2, height:DOT_R*2, borderRadius:"50%", background:color, border:"2px solid #1a1f2e" }} />
              <div style={{ width:STUB_W, height:2, background:color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LibItem({ eq, onDragStart, blocks }) {
  const prefix = getPrefix(eq.systemName);
  const nextName = prefix
    ? getNextSysName(prefix, (blocks || []).map(b => b.systemName))
    : (eq.systemName || null);
  return (
    <div draggable onDragStart={e => onDragStart(e, eq)}
      style={{ position:"relative", padding:"8px 10px", borderRadius:7, marginBottom:6,
        background:"#1e2433", border:"0.5px solid #2d3a52",
        cursor:"grab", userSelect:"none" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:2 }}>
        <div style={{ fontSize:10, color:"#7a8ab0" }}>{eq.manufacturer}</div>
        <span style={{ fontSize:9, background:"#2d3555", color:"#7a8ab0",
          border:"0.5px solid #3d4663", borderRadius:3, padding:"1px 5px", whiteSpace:"nowrap", marginLeft:6 }}>
          {eq.category}
        </span>
      </div>
      <div style={{ fontSize:13, fontWeight:500, color:"#c8d0e8" }}>{eq.model}</div>
      {nextName && (
        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
          <span style={{ fontSize:9, color:"#388bfd", fontWeight:500 }}>{nextName}</span>
          {nextName !== eq.systemName && (
            <span style={{ fontSize:8, color:"#555e7a" }}>(was {eq.systemName})</span>
          )}
        </div>
      )}
      <TinyBlock eq={eq} />
    </div>
  );
}

export default function Sidebar({ blocks, onDragStart }) {
  const [search, setSearch]       = useState("");
  const [filterMfr, setFilterMfr] = useState("All");
  const [filterCat, setFilterCat] = useState("All");

  const manufacturers = ["All", ...new Set(SAMPLE_LIBRARY.map(e => e.manufacturer))];
  const categories    = ["All", ...new Set(SAMPLE_LIBRARY.map(e => e.category))];

  const filtered = SAMPLE_LIBRARY.filter(eq => {
    const q = search.toLowerCase();
    const matchesSearch = !q || eq.model.toLowerCase().includes(q) ||
      eq.manufacturer.toLowerCase().includes(q) ||
      (eq.systemName||"").toLowerCase().includes(q);
    const matchesMfr = filterMfr === "All" || eq.manufacturer === filterMfr;
    const matchesCat = filterCat === "All" || eq.category === filterCat;
    return matchesSearch && matchesMfr && matchesCat;
  });

  return (
    <div style={{ width:140, background:"#13161f", borderRight:"1px solid #1e2433",
      display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
      <div style={{ padding:"8px 8px 6px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search model, system name..."
          onKeyDown={e => e.stopPropagation()}
          style={{ width:"100%", background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:5, color:"#c8d0e8", fontSize:10, padding:"5px 8px",
            outline:"none", boxSizing:"border-box" }} />
        <select value={filterMfr} onChange={e => setFilterMfr(e.target.value)}
          style={{ width:"100%", marginTop:5, background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:4, color:"#8892a8", fontSize:9, padding:"3px 6px" }}>
          {manufacturers.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ width:"100%", marginTop:4, background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:4, color:"#8892a8", fontSize:9, padding:"3px 6px" }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ fontSize:8, color:"#555e7a", marginTop:5 }}>
          {filtered.length} BLOCKS · DRAG TO CANVAS
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"0 8px 8px" }}>
        {filtered.map(eq => (
          <LibItem key={eq.id} eq={eq} blocks={blocks} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

export { SAMPLE_LIBRARY };
