let keytar = null;
try { keytar = require('keytar'); } catch {}
const Store = require('electron-store');
const kv = new Store({ name: 'aer-secure-fallback' });

const SERVICE = 'aer-mac';
const ACCOUNT = 'aer.token';
const KEY_ACCOUNT = 'aer.symmetric.key';

async function setToken(token) {
  if (keytar) return keytar.setPassword(SERVICE, ACCOUNT, token);
  kv.set(ACCOUNT, token);
}
async function getToken() {
  if (keytar) return keytar.getPassword(SERVICE, ACCOUNT);
  return kv.get(ACCOUNT) || null;
}
async function clearToken() {
  if (keytar) { try { await keytar.deletePassword(SERVICE, ACCOUNT); } catch {} return; }
  kv.delete(ACCOUNT);
}

async function getKey() {
  if (keytar) return keytar.getPassword(SERVICE, KEY_ACCOUNT);
  return kv.get(KEY_ACCOUNT) || null;
}
async function setKey(raw) {
  if (keytar) return keytar.setPassword(SERVICE, KEY_ACCOUNT, raw);
  kv.set(KEY_ACCOUNT, raw);
}

module.exports = { setToken, getToken, clearToken, getKey, setKey, SERVICE, ACCOUNT, KEY_ACCOUNT };
