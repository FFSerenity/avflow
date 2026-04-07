// ── AVFlow shared database module ─────────────────────────────────────────────
// Uses File System Access API (Chrome/Edge) for direct local folder read/write.
// Falls back to URL fetch (read-only) for Firefox / deployed environments.

const IDB_NAME  = 'avflow-db';
const IDB_STORE = 'handles';
const IDB_KEY   = 'dirHandle';

// ── IndexedDB: persist the directory handle across sessions ───────────────────
function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function saveHandle(handle) {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

export async function loadHandle() {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readonly');
  return new Promise((res, rej) => {
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => res(req.result || null);
    req.onerror   = () => rej(req.error);
  });
}

export async function clearHandle() {
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).delete(IDB_KEY);
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

// ── File System Access API: pick, read, write ─────────────────────────────────
export const fsaSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickDirectory() {
  if (!fsaSupported) throw new Error('File System Access API not supported in this browser');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveHandle(handle);
  return handle;
}

// Verify we still have permission (user may have revoked it)
export async function verifyPermission(handle) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

// Read all *.json files from a directory handle → flat array of blocks
export async function readAllBlocks(dirHandle) {
  const blocks = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const file = await entry.getFile();
      const data = JSON.parse(await file.text());
      if (Array.isArray(data)) blocks.push(...data);
    } catch (e) {
      console.warn(`db.js: failed to parse ${name}`, e);
    }
  }
  return blocks;
}

// Write all blocks for one manufacturer to {Manufacturer}.json
export async function writeManufacturerFile(dirHandle, manufacturer, allBlocks) {
  const mfrBlocks = allBlocks.filter(b => b.manufacturer === manufacturer);
  const safe = manufacturer.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const fileHandle = await dirHandle.getFileHandle(`${safe}.json`, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(JSON.stringify(mfrBlocks, null, 2));
  await writable.close();
}

// Save a single block: add-or-update its manufacturer file
export async function saveBlock(dirHandle, block, allBlocks) {
  const updated = allBlocks.find(b => b.id === block.id)
    ? allBlocks.map(b => b.id === block.id ? block : b)
    : [...allBlocks, block];
  await writeManufacturerFile(dirHandle, block.manufacturer, updated);
  return updated;
}

// Delete a block: update its manufacturer file
export async function deleteBlock(dirHandle, blockId, manufacturer, allBlocks) {
  const updated = allBlocks.filter(b => b.id !== blockId);
  await writeManufacturerFile(dirHandle, manufacturer, updated);
  return updated;
}

// ── URL fetch fallback (read-only, for deployed / Firefox) ────────────────────
// Fetches /database/index.json (list of filenames) then each file.
// Falls back to fetching known filenames if index.json is absent.
export async function fetchFromUrl(baseUrl = '/database/') {
  const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  let filenames = [];

  // Try fetching index.json manifest
  try {
    const res = await fetch(url + 'index.json');
    if (res.ok) filenames = await res.json();
  } catch (_) {}

  // If no index, try fetching directory listing via URL (won't work on Netlify)
  if (filenames.length === 0) {
    // Fallback: try a predictable list stored in localStorage
    const stored = localStorage.getItem('avflow_db_files');
    if (stored) filenames = JSON.parse(stored);
  }

  const blocks = [];
  for (const name of filenames) {
    try {
      const res = await fetch(url + name);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) blocks.push(...data);
    } catch (e) {
      console.warn(`db.js: failed to fetch ${name}`, e);
    }
  }
  return blocks;
}
