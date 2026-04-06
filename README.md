# AVFlow — AV System Design Tool

A CAD-style schematic design tool for AV (Audio/Visual) system integration. Built with React + Vite. Draw equipment blocks, wire them together, annotate, and organise into location zones.

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## Architecture Overview

```
src/
  Canvas.jsx        — Main app (3 300+ lines): all state, interaction, rendering
  BlockLibrary.jsx  — Equipment block definitions (Module 1)
  main.jsx          — React entry point
index.html          — App shell + global styles
```

Everything lives in `Canvas.jsx`. It is one large functional component. Splitting into sub-files is planned for Module 3.

---

## Feature Map

### 1. Equipment Blocks

- Dragged from the **sidebar library** onto the canvas
- Each block has a **header** (system name, manufacturer, model), **body** (pin rows), and **footer** (location, wattage)
- Pins expand from group definitions: `{ signal, qty, connector, direction, side }`
- Left pins = inputs, right pins = outputs
- **Double-click system name** in header to rename inline
- **Right-click block body** → Network Info modal (IP / MAC / PORT), displayed as badges above the header

### 2. Wires

- Left-click drag or click a pin dot → click destination pin dot to connect
- Color-coded by signal type (HDMI red, USB purple, LAN teal, RS-232 pink, power grey…)
- **`vx`** = x position of the vertical segment (drag the segment ↔ to move)
- **Add turn** (right-click wire) → inserts `{vx1, vx2, vy}` turn with three draggable handles
- Cable numbers auto-assigned by signal prefix (5xxx HDMI, 4xxx LAN, 9xxx USB…)
- Cable number labels float 1.5 grids from each pin on the first/last horizontal segment
- DRC: mismatched signal types render red dashed
- **Hit detection**: per-segment `<line>` elements with `pointer-events="stroke"` — interior of enclosed wire shapes does not trigger selection

### 3. Feather / Jump Tags

- Right-click drag OR right-click click a pin dot → creates a feather instead of a wire
- Source tag: chevron points **away** from its pin
- Dest tag: chevron points **toward** its pin
- Tag position stored as **pin-relative offset** (follows block when moved)
- **Drag chevron ↔** to extend/shorten the tail
- **Add turn** (right-click chevron) → L-shaped tail with vertical seg + new horizontal + chevron at end
  - Vertical segment drag ↔ moves `srcVx` / `dstVx`
  - Horizontal bridge drag ↕ moves `srcVy` / `dstVy`
  - Chevron drag ↔ extends `srcVx2` / `dstVx2`
- Source and dest turns are independent per tag

### 4. Location Boxes

- **Right-click empty canvas** → "Add location box"
- Full-width top strip = move handle; 8 resize handles on edges and corners
- **Double-click label** → rename inline; on blur, all blocks whose centre falls inside update their `location` field
- Multi-select: Ctrl+click = add, Shift+click = remove, marquee = window/crossing
- Selected boxes move together with any co-selected blocks and annotations

### 5. Spare Cable Runs

- **Right-click near a location box edge** → "Add spare cable run"
- Modal: set signal type, quantity, estimated length → click Next
- Canvas enters crosshair mode; **left-click** another location box edge to complete the run
- Rendered as a dashed line in signal color with anchor dots on both box edges
- Two-line centre badge: `SPARE 4S01` / `×4 CAT6 · 15m`
- Selectable, deletable, supports turns (same model as wires)

### 6. Annotations

Seven tools in the top-right toolbar (collapses to active tool icon):

| Tool | Shape |
|---|---|
| Text note | HTML overlay textarea, word-wraps to match SVG render |
| Leader | Line with arrowhead + editable label |
| Rectangle | Rect outline |
| Ellipse | Ellipse outline |
| Cloud | AutoCAD revision cloud (arc-per-side) |
| Arrow | Straight arrow |
| Dimension | Dimension line with editable value |

- 5 colours selectable in toolbar
- Right-click → Edit text / Duplicate / Delete
- Participate in multi-select and unified move/delete

### 7. Selection System

| Action | Result |
|---|---|
| Plain click | Exclusive select (clears all other types) |
| Ctrl+click | Add to selection |
| Shift+click | Remove from selection |
| Left→right drag | Window select (fully inside only) |
| Right→left drag | Crossing select (anything touching) |
| Delete / Backspace | Delete all selected items in one pass |

All element types (blocks, wires, feathers, annotations, location boxes, spare runs) participate in the same selection system. Dragging any element in a multi-select group moves all selected elements together, including wire `vx`/`vy` adjustment for wires where both endpoints are selected.

### 8. Network Info

- Right-click block body → "Add/Edit network info"
- Fields: IP (green), MAC (blue), PORT (amber)
- Stored as `block.ipInfo = { ip, mac, port }`
- Displayed as stacked pill badges above the block header when set
- "Clear network info" removes all fields

### 9. Canvas Navigation

- **Scroll** to zoom (toward cursor)
- **Alt+drag** to pan
- Zoom range: 0.2× – 3×
- 16px grid with snap

---

## Data Model

### Block
```js
{
  id: "b-1",
  eq: { /* equipment definition from library */ },
  x, y,                    // canvas position (snapped to 4px grid)
  systemName: "DIS01",
  location: "Room A",
  ipInfo: { ip, mac, port } // optional
}
```

### Wire
```js
{
  id: "w-1",
  fromBlockId, fromPinId,
  toBlockId, toPinId,
  signal, color, cableNum,
  dashed: false,           // true = DRC mismatch
  vx: null,                // vertical segment x (absolute canvas coords)
  turns: [{ vx1, vx2, vy }], // each turn adds one staircase bend
  feather: false,          // true = jump tag instead of wire
  // feather-only:
  vx: null,   // srcOffset (pin-relative)
  vx2: null,  // dstOffset (pin-relative)
  srcVy, dstVy,            // vertical bend offsets
  srcVx2, dstVx2,          // new horizontal reach after bend
}
```

### Location Box
```js
{
  id: "lb-1",
  x, y, w, h,
  label: "Room A Rack"
}
```

### Spare Run
```js
{
  id: "sp-1",
  fromLocBoxId, fromEdgeY,  // right edge of fromLb + Y offset
  toLocBoxId, toEdgeY,      // left edge of toLb + Y offset
  signal, color, cableNum,
  qty: "4", length: "15m",
  vx: null, turns: []       // same routing model as wires
}
```

---

## Pending Modules

| Module | Description |
|---|---|
| 3 | Project & Data Layer (save/load JSON, connect full Samsung DB) |
| 4 | Wiring Rules Engine (configurable cable numbering, DRC rules) |
| 5 | Outputs (cable pull schedule Excel, rack elevation, DWG export) |
| 6 | Template System |
| — | Undo/Redo (history stack) |
| — | Excel import/export (block/wire data round-trip) |

---

## Signal Colors

| Signal | Color |
|---|---|
| HDMI, DisplayPort, DVI, VGA, SDI | `#E24B4A` red |
| USB-A, USB-B, USB-C | `#7F77DD` purple |
| RJ45 LAN | `#1D9E75` teal |
| Audio, Phoenix, 3.5mm | `#EF9F27` amber |
| RS-232, IR, Control | `#D4537E` pink |
| IEC Power, DC | `#888780` grey |
| Fiber, Coaxial | `#85B7EB` blue |

## Cable Number Prefixes

| Prefix | Signal |
|---|---|
| 1xxx | Audio |
| 2xxx | Speaker |
| 3xxx | Power |
| 4xxx | CAT / LAN |
| 5xxx | Video |
| 6xxx | Coax |
| 7xxx | Fiber |
| 8xxx | Control |
| 9xxx | USB |

Spare runs use the same prefix + `S` suffix: `4S01`, `5S01`, etc.

---

## Samsung Equipment Database

File: `Samsung.xml` (actually SQLite — rename to `.db` to open with SQLite tools)

- 158 equipment rows in `Full_Table` and `EQ`
- Pin encoding: `SignalType:Qty_Connector(Description` backslash-delimited
- Dimensions in mm; `INs` = left side, `OUTs` = right side
- Ready for full library import when Module 3 is built
