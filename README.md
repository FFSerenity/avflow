# AVFlow — AV System Design Tool

A CAD-style schematic design tool for AV (Audio/Visual) system integration. Built with React + Vite. Draw equipment blocks, wire them together, annotate, and organise into location zones.

## Live Demo

- **Canvas:** https://ffserenity.github.io/avflow/
- **Block Library:** https://ffserenity.github.io/avflow/library/

## Quick Start

```bash
npm install

# Main canvas
npm run dev        # → http://localhost:5173

# Block library (separate dev server)
npm run dev:lib    # → http://localhost:5174
```

## Project Structure

```
avflow/
  src/
    Canvas.jsx               — Main app: all canvas state, interaction, rendering
    constants.js             — Signal colours, grid/layout constants
    geometry.js              — Pin positioning, wire routing, expand-groups
    main.jsx                 — React entry point
    components/
      BlockView.jsx          — Canvas block renderer (pins, header, body, footer)
      Sidebar.jsx            — Left panel: block library, search, filters, SAMPLE_LIBRARY
  library-dev/
    LibraryApp.jsx           — Standalone block library UI (grid + block editor)
    index.html               — HTML shell for library dev server
    main.jsx                 — Library entry point
    vite.config.js           — Port 5174, resolves ../src imports
  index.html                 — App shell
  package.json
  vite.config.js
```

## Architecture

### Canvas (`src/Canvas.jsx`)
The main application. All state, interaction, and rendering lives here. Key areas:
- **Block management** — drag from sidebar, place, move, select, delete
- **Wire routing** — click pin → click pin to connect, animated dashes
- **Location zones** — draw rectangular zones, label by location
- **Annotations** — sticky-note style text labels
- **IP info** — per-block IP/MAC/port badges shown above the block
- **Context menus** — right-click blocks and wires for actions
- **Export** — PNG snapshot of the canvas

### Block rendering (`src/components/BlockView.jsx`)
Renders a single equipment block on the canvas. Layout constants (all in `src/constants.js`):

| Constant | Value | Purpose |
|----------|-------|---------|
| `ROW_H` | 16px | Height of each pin row |
| `HEADER_H` | 40px | Block header (system name / mfr / model) |
| `FOOTER_H` | 16px | Block footer (location / wattage) |
| `BODY_W` | 160px | Body width |
| `PAD_W` | 64px | Stub area on each side |
| `DOT_R` | 4px | Pin dot radius |
| `STUB_W` | 28px | Pin stub line length |

Total block width = `PAD_W + BODY_W + PAD_W` = **288px**

### Signal colours (`src/constants.js`)

| Signal type | Colour |
|-------------|--------|
| HDMI / DP / DVI / VGA / SDI | `#E24B4A` red |
| USB (all variants) | `#7F77DD` purple |
| RJ45 LAN / PoE / DM | `#1D9E75` teal |
| Audio / Phoenix | `#EF9F27` amber |
| RS-232 / IR / GPIO / Relay | `#D4537E` pink |
| Power (IEC / NEMA / DC) | `#888780` grey |
| Fiber / Coax / BNC | `#85B7EB` blue |

### Block Library (`library-dev/`)
A standalone Vite dev server for creating and editing equipment blocks. Imports `SAMPLE_LIBRARY` from `src/components/Sidebar.jsx` so both apps share the same block data.

**Card layout:** Fixed 200×200px squares. Preview viewport is 190×126px.  
Scale formula: `SCALE = Math.min(1, 190 / blockW, 126 / blockH)` — blocks auto-fit with no overflow.  
Change `CARD_SIZE` in `LibraryApp.jsx` to resize all cards; update `CARD_PREVIEW_W/H` to match (measure from DevTools after resizing).

## Data Model

### Equipment block
```js
{
  id: "eq-001",
  manufacturer: "Samsung",
  model: "QB85C",
  category: "Display",
  width: 75.6, height: 44.3, depth: 2.5, unit: "in",
  wattage: 300,
  systemName: "DIS01",
  location: "J1.01 (FRONT WALL)",
  groups: [
    {
      id: "g1",
      signal: "HDMI",           // see SIGNAL_TYPES in LibraryApp.jsx
      qty: 3,                   // expands to 3 individual pins
      connector: "HDMI Type A",
      direction: "Input" | "Output" | "Bidirectional",
      side: "left" | "right",
      description: ""           // auto-generates "HDMI 01/02/03" if blank
    }
  ]
}
```

### Canvas block (extends equipment block)
```js
{
  id: "block-1",
  eq: { /* equipment block above */ },
  x: 320, y: 240,           // canvas position
  systemName: "DIS01",       // may override eq.systemName
  location: "RACK01",        // may override eq.location
  ipInfo: { ip: "192.168.1.10", mac: "AA:BB:CC:DD:EE:FF", port: "80" }
}
```

### Wire
```js
{
  id: "wire-1",
  fromBlock: "block-1", fromPin: "g1-1",  // pin id = groupId-pinIndex
  toBlock:   "block-2", toPin:   "g2-1",
  signal: "HDMI"
}
```

## Roadmap

| Module | Status | Description |
|--------|--------|-------------|
| 1 — Block Library | ✅ Done | Equipment block editor + card grid (`library-dev/`) |
| 2 — Canvas | ✅ Done | Drag, wire, zone, annotate, export |
| 3 — Data Layer | 🔲 Planned | Save/load JSON, sync library ↔ canvas, SQLite import |
| 4 — Reports | 🔲 Planned | Cable schedule, equipment list, rack elevation export |

## Repo
[https://github.com/FFSerenity/avflow](https://github.com/FFSerenity/avflow)
