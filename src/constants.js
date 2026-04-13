// ── Signal colors ───────────────────────────────────────────────────────────
export const SIGNAL_COLORS = {
  // ── Video ──────────────────────────────────────────────────────────────────
  "HDMI":"#E24B4A","DisplayPort":"#E24B4A","DVI":"#E24B4A","VGA":"#E24B4A","SDI":"#E24B4A",
  // Simplified aliases from imported database
  "Video":"#E24B4A",
  // ── USB ────────────────────────────────────────────────────────────────────
  "USB-A":"#7F77DD","USB-B":"#7F77DD","USB-C":"#7F77DD","USB 2.0":"#7F77DD","USB 3.0":"#7F77DD",
  // Simplified aliases
  "USB":"#7F77DD","Data":"#7F77DD",
  // ── Network / LAN ──────────────────────────────────────────────────────────
  "RJ45 LAN":"#1D9E75","RJ45 PoE":"#1D9E75","RJ45 PoE+":"#1D9E75","RJ45 PoE++":"#1D9E75","RJ45 DM":"#1D9E75",
  // Simplified aliases
  "LAN":"#1D9E75",
  // ── Audio ──────────────────────────────────────────────────────────────────
  "3.5mm Stereo":"#EF9F27","3.5mm Mono":"#EF9F27","XLR":"#EF9F27","RCA":"#EF9F27",
  "Phoenix 2-pin":"#EF9F27","Phoenix 3-pin":"#EF9F27","Phoenix 5-pin":"#EF9F27","Phoenix 6-pin":"#EF9F27",
  // Simplified aliases
  "Audio":"#EF9F27","Dante":"#EF9F27","Intercom":"#EF9F27",
  // ── Control / Serial ───────────────────────────────────────────────────────
  "RS-232":"#D4537E","RS-485":"#D4537E","IR":"#D4537E","GPIO":"#D4537E","Relay":"#D4537E",
  // Simplified aliases
  "Control":"#D4537E","Cresnet":"#D4537E",
  // ── Power ──────────────────────────────────────────────────────────────────
  "IEC Power":"#888780","NEMA 5-15":"#888780","DC Barrel":"#888780","DC Phoenix":"#888780",
  // Simplified aliases
  "Power":"#888780",
  // ── Fibre / Coaxial / RF ───────────────────────────────────────────────────
  "Fiber":"#85B7EB","Coaxial":"#85B7EB","BNC":"#85B7EB",
  // Simplified aliases
  "Fibre":"#85B7EB","RF":"#85B7EB",
  // ── Other ──────────────────────────────────────────────────────────────────
  "Other":"#B4B2A9","Hybrid":"#B4B2A9","Sync":"#B4B2A9",
};

export const CABLE_PREFIX = {
  "HDMI":5,"DisplayPort":5,"DVI":5,"VGA":5,"SDI":5,"Video":5,
  "USB-A":9,"USB-B":9,"USB-C":9,"USB 2.0":9,"USB 3.0":9,"USB":9,"Data":9,
  "RJ45 LAN":4,"RJ45 PoE":4,"RJ45 PoE+":4,"RJ45 PoE++":4,"RJ45 DM":4,"LAN":4,
  "3.5mm Stereo":1,"XLR":1,"RCA":1,
  "Phoenix 2-pin":2,"Phoenix 3-pin":2,"Phoenix 5-pin":2,"Phoenix 6-pin":2,
  "Audio":1,"Dante":1,"Intercom":1,
  "RS-232":8,"RS-485":8,"IR":8,"GPIO":8,"Relay":8,"Control":8,"Cresnet":8,
  "IEC Power":3,"NEMA 5-15":3,"DC Barrel":3,"DC Phoenix":3,"Power":3,
  "Fiber":7,"Coaxial":6,"BNC":6,"Fibre":7,"RF":6,
  "Other":9,"Hybrid":9,"Sync":9,
};

// ── Layout constants (all grid-aligned, GRID=16) ─────────────────────────────
export const GRID     = 16;
export const snap     = v => Math.round(v / GRID) * GRID;
export const snapG    = v => Math.round(v / GRID) * GRID;
export const ROW_H    = 16;
export const HEADER_H = 40;
export const FOOTER_H = 16;
export const BODY_W   = 160;
export const STUB_W   = 28;
export const PAD_W    = 64;
export const DOT_R    = 4;

// ── Annotation tools & colors ────────────────────────────────────────────────
export const ANNOT_COLORS = ["#ffffff","#E24B4A","#EF9F27","#378ADD","#639922"];
