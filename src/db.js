// ── AVFlow shared database module ─────────────────────────────────────────────
// Uses File System Access API (Chrome/Edge) for direct local folder read/write.
// Falls back to URL fetch (read-only) for Firefox / deployed environments.

const IDB_NAME  = 'avflow-db';
const IDB_STORE = 'handles';
const IDB_KEY   = 'dirHandle';

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

export const fsaSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickDirectory() {
  if (!fsaSupported) throw new Error('File System Access API not supported in this browser');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveHandle(handle);
  return handle;
}

export async function verifyPermission(handle) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

function safeFilename(manufacturer) {
  if (!manufacturer || !manufacturer.trim()) return null;
  const safe = manufacturer.trim().replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  return safe || null;
}

// Read all manufacturer *.json files — skips index.json and dotfiles
export async function readAllBlocks(dirHandle) {
  const blocks = [];
  for await (const [name, entry] of dirHandle.entries()) {
    if (entry.kind !== 'file') continue;
    if (!name.endsWith('.json')) continue;
    if (name === 'index.json') continue;
    if (name.startsWith('.')) continue;
    try {
      const file = await entry.getFile();
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) continue;
      blocks.push(...data.filter(b => b && b.id && b.manufacturer));
    } catch (e) {
      console.warn(`db.js: failed to parse ${name}`, e);
    }
  }
  return blocks;
}

async function updateIndexJson(dirHandle, allBlocks) {
  const manufacturers = [...new Set(allBlocks.map(b => b.manufacturer).filter(Boolean))].sort();
  const filenames = manufacturers.map(m => safeFilename(m)).filter(Boolean).map(s => `${s}.json`);
  try {
    const fh = await dirHandle.getFileHandle('index.json', { create: true });
    const w  = await fh.createWritable();
    await w.write(JSON.stringify(filenames, null, 2));
    await w.close();
  } catch (e) {
    console.warn('db.js: failed to update index.json', e);
  }
}

export async function writeManufacturerFile(dirHandle, manufacturer, allBlocks) {
  const safe = safeFilename(manufacturer);
  if (!safe) { console.warn('db.js: skipping — empty manufacturer'); return; }
  const mfrBlocks = allBlocks.filter(b => b.manufacturer === manufacturer);
  const fileHandle = await dirHandle.getFileHandle(`${safe}.json`, { create: true });
  const writable   = await fileHandle.createWritable();
  await writable.write(JSON.stringify(mfrBlocks, null, 2));
  await writable.close();
  await updateIndexJson(dirHandle, allBlocks);
}

export async function saveBlock(dirHandle, block, allBlocks) {
  if (!block.manufacturer || !block.manufacturer.trim()) {
    console.warn('db.js: cannot save block with empty manufacturer');
    return allBlocks;
  }
  const updated = allBlocks.find(b => b.id === block.id)
    ? allBlocks.map(b => b.id === block.id ? block : b)
    : [...allBlocks, block];
  await writeManufacturerFile(dirHandle, block.manufacturer, updated);
  return updated;
}

export async function deleteBlock(dirHandle, blockId, manufacturer, allBlocks) {
  const updated = allBlocks.filter(b => b.id !== blockId);
  if (manufacturer && manufacturer.trim()) {
    await writeManufacturerFile(dirHandle, manufacturer, updated);
  }
  return updated;
}

export async function fetchFromUrl(baseUrl = 'https://raw.githubusercontent.com/FFSerenity/avflow/main/database/') {
  const url = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  let filenames = [];
  try {
    const res = await fetch(url + 'index.json');
    if (res.ok) filenames = await res.json();
  } catch (_) {}

  const blocks = [];
  for (const name of filenames) {
    if (!name || name === 'index.json' || name.startsWith('.')) continue;
    try {
      const res = await fetch(url + name);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) blocks.push(...data.filter(b => b && b.id && b.manufacturer));
    } catch (e) {
      console.warn(`db.js: failed to fetch ${name}`, e);
    }
  }
  return blocks;
}
