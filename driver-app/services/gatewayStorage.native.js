import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

let database;
async function db() {
  if (!database) database = (async () => {
    const value = await SQLite.openDatabaseAsync('empimecatronic-gateway.db');
    await value.execAsync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS frames (owner TEXT NOT NULL, device TEXT NOT NULL, event TEXT NOT NULL, body TEXT NOT NULL, captured TEXT NOT NULL, error TEXT, PRIMARY KEY(owner,device,event));
      CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    return value;
  })();
  return database;
}
export async function enqueue(owner, packet) {
  const store = await db();
  const existing = await store.getFirstAsync('SELECT event FROM frames WHERE owner=? AND device=? AND event=?', owner, packet.frame.deviceCode, packet.frame.eventId);
  if (existing) return;
  const { count } = await store.getFirstAsync('SELECT COUNT(*) AS count FROM frames', []);
  if (count >= 100000) throw new Error('Armazenamento de coleta cheio. Sincronize antes de continuar.');
  await store.runAsync('INSERT OR IGNORE INTO frames(owner,device,event,body,captured) VALUES(?,?,?,?,?)', owner, packet.frame.deviceCode, packet.frame.eventId, JSON.stringify({ raw: packet.raw, signature: packet.signature, capturedAt: packet.capturedAt }), packet.capturedAt);
}
export async function pending(owner) { return (await db()).getAllAsync('SELECT * FROM frames WHERE owner=? AND error IS NULL ORDER BY captured LIMIT 30', owner); }
export async function confirm(owner, device, event) { await (await db()).runAsync('DELETE FROM frames WHERE owner=? AND device=? AND event=?', owner, device, event); }
export async function reject(owner, device, event, error) { await (await db()).runAsync('UPDATE frames SET error=? WHERE owner=? AND device=? AND event=?', error, owner, device, event); }
export async function stats(owner) { return (await db()).getFirstAsync('SELECT COUNT(*) AS total, SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS rejected FROM frames WHERE owner=?', owner); }
export async function retryRejected(owner) { await (await db()).runAsync('UPDATE frames SET error=NULL WHERE owner=?', owner); }
export async function cacheGet(key) { const item = await (await db()).getFirstAsync('SELECT value FROM cache WHERE key=?', key); return item ? JSON.parse(item.value) : null; }
export async function cacheSet(key, value) { await (await db()).runAsync('INSERT OR REPLACE INTO cache(key,value) VALUES(?,?)', key, JSON.stringify(value)); }
export async function saveSession(value) { if (value) await SecureStore.setItemAsync('emp-session', JSON.stringify(value)); else await SecureStore.deleteItemAsync('emp-session'); }
export async function readSession() { const value = await SecureStore.getItemAsync('emp-session'); return value ? JSON.parse(value) : null; }
