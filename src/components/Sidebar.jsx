import { useState, useEffect } from "react";
import { SIGNAL_COLORS, ROW_H, HEADER_H, FOOTER_H, BODY_W, PAD_W, STUB_W, DOT_R } from "../constants.js";
import { expandGroups, getPrefix, getNextSysName } from "../geometry.js";
import { fsaSupported, loadHandle, saveHandle, verifyPermission, pickDirectory, readAllBlocks, fetchFromUrl } from "../db.js";

// Fallback built-in library (used when no database folder is connected)
const SAMPLE_LIBRARY = [
  { id:"eq-001", manufacturer:"Samsung", model:"QB85C", category:"Display",
    comment:"85\" Crystal UHD Signage",
    width:74.97, height:42.73, depth:1.12, unit:"in", wattage:300,
    systemName:"DIS01", location:"",
    groups:[
      {id:"g1",signal:"HDMI",qty:2,connector:"HDMI Type A",direction:"Input",side:"left",description:"HDMI"},
      {id:"g2",signal:"HDMI",qty:1,connector:"HDMI Type A",direction:"Input",side:"left",description:"HDMI 3 ARC"},
      {id:"g3",signal:"USB-A",qty:2,connector:"USB Type-A",direction:"Input",side:"left",description:"USB 2.0"},
      {id:"g4",signal:"RS-232",qty:1,connector:"TRS 3.5mm",direction:"Input",side:"left",description:"RS-232C"},
      {id:"g5",signal:"RJ45 LAN",qty:1,connector:"RJ45",direction:"Input",side:"left",description:"LAN"},
      {id:"g6",signal:"IR",qty:1,connector:"TRS 3.5mm",direction:"Input",side:"left",description:"IR"},
      {id:"g7",signal:"IEC Power",qty:1,connector:"IEC 60320 C13",direction:"Input",side:"left",description:"POWER"},
      {id:"g8",signal:"3.5mm Stereo",qty:1,connector:"TRS 3.5mm",direction:"Output",side:"right",description:"STEREO"},
      {id:"g9",signal:"RS-232",qty:1,connector:"TRS 3.5mm",direction:"Output",side:"right",description:"RS-232C"},
    ]},
];

function TinyBlock({ eq }) {
  const pins = expandGroups(eq.groups || []);
  const left = pins.filter(p => p.side === "left");
  const right = pins.filter(p => p.side === "right");
  const rows = Math.max(left.length, right.length, 1);
  const bH = HEADER_H + rows * ROW_H + FOOTER_H;
  const bW = PAD_W + BODY_W + PAD_W;
  const SCALE = 0.28;
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
        <div style={{ fontSize:11, color:"#7a8ab0" }}>{eq.manufacturer}</div>
        <span style={{ fontSize:10, background:"#2d3555", color:"#7a8ab0",
          border:"0.5px solid #3d4663", borderRadius:3, padding:"1px 5px", whiteSpace:"nowrap", marginLeft:6 }}>
          {eq.category}
        </span>
      </div>
      <div style={{ fontSize:14, fontWeight:500, color:"#c8d0e8" }}>{eq.model}</div>
      {nextName && (
        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
          <span style={{ fontSize:10, color:"#388bfd", fontWeight:500 }}>{nextName}</span>
          {nextName !== eq.systemName && (
            <span style={{ fontSize:9, color:"#555e7a" }}>(was {eq.systemName})</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ blocks, onDragStart }) {
  const [search,    setSearch]    = useState("");
  const [filterMfr, setFilterMfr] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [library,   setLibrary]   = useState(SAMPLE_LIBRARY);
  const [dirHandle, setDirHandle] = useState(null);
  const [dbStatus,  setDbStatus]  = useState("built-in"); // "built-in" | "connected" | "syncing" | "error"

  // On mount: restore persisted directory handle and load blocks
  useEffect(() => {
    (async () => {
      if (!fsaSupported) {
        // Try URL fetch from /database/
        try {
          const fetched = await fetchFromUrl("/database/");
          if (fetched.length > 0) { setLibrary(fetched); setDbStatus("connected"); }
        } catch (_) {}
        return;
      }
      const h = await loadHandle().catch(() => null);
      if (!h) return;
      const ok = await verifyPermission(h).catch(() => false);
      if (!ok) return;
      setDirHandle(h);
      setDbStatus("syncing");
      try {
        const data = await readAllBlocks(h);
        if (data.length > 0) { setLibrary(data); setDbStatus("connected"); }
        else setDbStatus("connected");
      } catch (e) {
        console.error("db sync error", e);
        setDbStatus("error");
      }
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

  const handleSync = async () => {
    if (!dirHandle) return;
    setDbStatus("syncing");
    try {
      const ok = await verifyPermission(dirHandle);
      if (!ok) { setDbStatus("error"); return; }
      const data = await readAllBlocks(dirHandle);
      if (data.length > 0) setLibrary(data);
      setDbStatus("connected");
    } catch (e) {
      console.error(e);
      setDbStatus("error");
    }
  };

  const manufacturers = ["All", ...new Set(library.map(e => e.manufacturer))];
  const categories    = ["All", ...new Set(library.map(e => e.category))];

  const filtered = library.filter(eq => {
    const q = search.toLowerCase();
    const matchesSearch = !q || eq.model.toLowerCase().includes(q) ||
      eq.manufacturer.toLowerCase().includes(q) ||
      (eq.systemName||"").toLowerCase().includes(q);
    return matchesSearch &&
      (filterMfr === "All" || eq.manufacturer === filterMfr) &&
      (filterCat === "All" || eq.category === filterCat);
  });

  const statusColor = { "built-in":"#555e7a", connected:"#1D9E75", syncing:"#EF9F27", error:"#E24B4A" }[dbStatus];
  const statusLabel = { "built-in":"built-in", connected:"database connected", syncing:"syncing…", error:"connection error" }[dbStatus];

  return (
    <div style={{ width:200, background:"#13161f", borderRight:"1px solid #1e2433",
      display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>

      {/* ── Brand header ── */}
      <div style={{ padding:"12px 12px 10px", borderBottom:"1px solid #1e2433",
        display:"flex", alignItems:"center", gap:8 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#388bfd" opacity="0.9"/>
          <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#388bfd" opacity="0.6"/>
          <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#388bfd" opacity="0.6"/>
          <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#388bfd" opacity="0.35"/>
        </svg>
        <span style={{ color:"#c8d0e8", fontWeight:700, fontSize:15, letterSpacing:"0.5px" }}>AVFlow</span>
      </div>

      {/* ── Database panel ── */}
      <div style={{ padding:"8px 10px", borderBottom:"1px solid #1e2433" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:statusColor, flexShrink:0 }} />
            <span style={{ fontSize:10, color:statusColor }}>{statusLabel}</span>
          </div>
          {dirHandle && (
            <button onClick={handleSync} disabled={dbStatus === "syncing"}
              title="Reload all blocks from the database folder"
              style={{ fontSize:10, padding:"2px 7px", cursor:"pointer", borderRadius:4,
                background:"#1e2433", border:"0.5px solid #2d3a52", color:"#8892a8",
                opacity: dbStatus === "syncing" ? 0.5 : 1 }}>
              ↻ Sync
            </button>
          )}
        </div>
        {fsaSupported ? (
          <button onClick={handlePickFolder}
            title="Connect a local database folder to load blocks from JSON files"
            style={{ width:"100%", fontSize:11, padding:"5px 0", cursor:"pointer", borderRadius:5,
              background:"#1e2433", border:"0.5px solid #2d3a52", color:"#8892a8" }}>
            {dirHandle ? "⌂ Change database folder" : "⌂ Connect database folder"}
          </button>
        ) : (
          <div style={{ fontSize:10, color:"#555e7a", lineHeight:1.4 }}>
            Folder sync requires Chrome or Edge
          </div>
        )}
      </div>

      {/* ── Search & filters ── */}
      <div style={{ padding:"10px 10px 8px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search model, system name..."
          onKeyDown={e => e.stopPropagation()}
          style={{ width:"100%", background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:5, color:"#c8d0e8", fontSize:12, padding:"6px 10px",
            outline:"none", boxSizing:"border-box" }} />
        <select value={filterMfr} onChange={e => setFilterMfr(e.target.value)}
          style={{ width:"100%", marginTop:6, background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:4, color:"#8892a8", fontSize:11, padding:"5px 8px" }}>
          {manufacturers.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ width:"100%", marginTop:5, background:"#1e2433", border:"0.5px solid #2d3a52",
            borderRadius:4, color:"#8892a8", fontSize:11, padding:"5px 8px" }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ fontSize:10, color:"#555e7a", marginTop:6 }}>
          {filtered.length} BLOCKS · DRAG TO CANVAS
        </div>
      </div>

      {/* ── Library list ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 10px 10px" }}>
        {filtered.map(eq => (
          <LibItem key={eq.id} eq={eq} blocks={blocks} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

export { SAMPLE_LIBRARY };
