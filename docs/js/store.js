// Lokale Speicherung: Bäume + Erledigt-Status in localStorage, Fotos in IndexedDB.
const K_TREES = 'bonsaijahr.trees', K_DONE = 'bonsaijahr.done', K_PREF = 'bonsaijahr.prefs';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const getTrees = () => read(K_TREES, []);
export const saveTrees = t => write(K_TREES, t);
export function upsertTree(tree) { const t = getTrees(); const i = t.findIndex(x => x.id === tree.id); if (i >= 0) t[i] = tree; else t.push(tree); saveTrees(t); }
export function deleteTree(id) {
  saveTrees(getTrees().filter(t => t.id !== id));
  const d = getDone(); for (const k of Object.keys(d)) if (k.startsWith(id + '|')) delete d[k]; write(K_DONE, d);
  return deletePhoto(id).catch(() => {});
}
export const getDone = () => read(K_DONE, {});
export function setDone(key, on) { const d = getDone(); if (on) d[key] = new Date().toISOString(); else delete d[key]; write(K_DONE, d); }
export const getPrefs = () => read(K_PREF, {});
export const setPref = (k, v) => write(K_PREF, { ...getPrefs(), [k]: v });

let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('bonsaijahr', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('photos', mode); const r = fn(t.objectStore('photos')); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
export const putPhoto = (id, blob) => tx('readwrite', s => s.put(blob, id));
export const getPhoto = id => tx('readonly', s => s.get(id));
export const deletePhoto = id => tx('readwrite', s => s.delete(id));

/** Scales an image file down (max. 1280 px) and returns a JPEG blob. */
export async function shrinkImage(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}
