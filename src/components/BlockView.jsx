import { SIGNAL_COLORS, ROW_H, HEADER_H, FOOTER_H, BODY_W, PAD_W, STUB_W, DOT_R } from "../constants.js";
import { expandGroups } from "../geometry.js";

export default function BlockView({ block, selected, onMouseDownHeader, onContextMenu }) {
  const pins  = expandGroups(block.eq.groups || []);
  const left  = pins.filter(p => p.side === "left");
  const right = pins.filter(p => p.side === "right");
  const rows  = Math.max(left.length, right.length, 1);
  const blockH = HEADER_H + rows * ROW_H + FOOTER_H;
  const blockW = PAD_W + BODY_W + PAD_W;
  const borderColor = selected ? "#388bfd" : "#3d4663";

  const PinRow = ({ p, side }) => {
    const color = SIGNAL_COLORS[p.signal] || "#888";
    const isLeft = side === "left";
    return (
      <div style={{ position:"relative", height: ROW_H, display:"flex",
        alignItems:"center", flexDirection: isLeft ? "row-reverse" : "row" }}>
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
  };

  const net = block.ipInfo;
  const hasNet = net && (net.ip || net.mac || net.port);

  return (
    <div style={{ position:"absolute", left: block.x, top: block.y,
      width: blockW, height: blockH, userSelect:"none" }}>

      {hasNet && (() => {
        const tag = (label, value, fg, bg, border) => (
          <div style={{ display:"inline-flex", alignItems:"stretch",
            border:`0.5px solid ${border}`, borderRadius:3, overflow:"hidden",
            whiteSpace:"nowrap", lineHeight:1 }}>
            <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:600,
              color: fg, background: bg, padding:"2px 5px", borderRight:`0.5px solid ${border}` }}>
              {label}
            </span>
            <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:500,
              color: fg, background:"rgba(0,0,0,0.25)", padding:"2px 6px" }}>
              {value}
            </span>
          </div>
        );
        return (
          <div style={{ position:"absolute", left: PAD_W, bottom: blockH + 4,
            width: BODY_W, display:"flex", flexDirection:"column",
            alignItems:"flex-start", gap:3, pointerEvents:"none" }}>
            {net.ip   && tag("IP",   net.ip,   "#1D9E75", "rgba(29,158,117,0.18)",  "rgba(29,158,117,0.45)")}
            {net.mac  && tag("MAC",  net.mac,  "#85B7EB", "rgba(133,183,235,0.18)", "rgba(133,183,235,0.45)")}
            {net.port && tag("PORT", net.port, "#EF9F27", "rgba(239,159,39,0.18)",  "rgba(239,159,39,0.45)")}
          </div>
        );
      })()}

      {/* Header — drag handle */}
      <div onMouseDown={onMouseDownHeader} onContextMenu={onContextMenu}
        style={{ position:"absolute", left: PAD_W, top:0, width: BODY_W, height: HEADER_H,
          background:"#2d3555", borderRadius:"6px 6px 0 0",
          borderTop:`2px solid ${borderColor}`, borderLeft:`2px solid ${borderColor}`,
          borderRight:`2px solid ${borderColor}`,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          cursor:"grab", padding:"4px 6px" }}>
        <div style={{ fontSize:10, fontWeight:600, color:"#a8d4ff", lineHeight:1.3, textAlign:"center" }}>
          {block.systemName || block.eq.systemName}
        </div>
        <div style={{ fontSize:7, color:"#7a8ab0", lineHeight:1.2 }}>{block.eq.manufacturer}</div>
        <div style={{ fontSize:9, fontWeight:500, color:"#c8d0e8", lineHeight:1.2, textAlign:"center" }}>
          {block.eq.model}
        </div>
      </div>

      {/* Body */}
      <div onContextMenu={onContextMenu}
        style={{ position:"absolute", left: PAD_W, top: HEADER_H,
          width: BODY_W, height: rows * ROW_H, background:"#1e2433",
          borderLeft:`2px solid ${borderColor}`, borderRight:`2px solid ${borderColor}` }}>
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
      <div onContextMenu={onContextMenu}
        style={{ position:"absolute", left: PAD_W, top: HEADER_H + rows * ROW_H,
          width: BODY_W, height: FOOTER_H, background:"#1e2433",
          borderRadius:"0 0 6px 6px",
          borderBottom:`2px solid ${borderColor}`, borderLeft:`2px solid ${borderColor}`,
          borderRight:`2px solid ${borderColor}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 6px" }}>
        <span style={{ fontSize:7, color:"#7a8ab0", overflow:"hidden",
          textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>
          {block.location || block.eq.location}
        </span>
        {block.eq.wattage > 0 && <span style={{ fontSize:7, color:"#555e7a" }}>{block.eq.wattage}W</span>}
      </div>

      {/* Left pin stubs */}
      <div style={{ position:"absolute", left:0, top: HEADER_H, width: PAD_W }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}>
        {left.map(p => <PinRow key={p.id} p={p} side="left" />)}
      </div>

      {/* Right pin stubs */}
      <div style={{ position:"absolute", right:0, top: HEADER_H, width: PAD_W }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}>
        {right.map(p => <PinRow key={p.id} p={p} side="right" />)}
      </div>
    </div>
  );
}
