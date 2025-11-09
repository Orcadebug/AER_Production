const { app, Tray, Menu, BrowserWindow, globalShortcut, clipboard, shell, ipcMain, nativeImage, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
async function activeWinDynamic() { try { const m = await import('active-win'); return m.default(); } catch { return null; } }
const { watchOnline, getOnline } = require('./utils/online');
const { setToken, clearToken, getToken } = require('./utils/keychain');
const { captureInteractive } = require('./utils/capture');
const { runOCR } = require('./utils/ocr');
const { analyzePremium } = require('./utils/premium');
const { encryptBuffer, ensureKey } = require('./utils/encryption');
const { uploadEncrypted } = require('./utils/uploader');

const store = new Store({ name: 'settings' });
let tray;
let overlayWin = null;
let connectWin = null;
let prefsWin = null;
let lastCaptureBuffer = null;
let connectedState = false;

const DEFAULT_BASE_URL = 'https://honorable-porpoise-222.convex.site';
const UI_SITE_URL = 'https://aercarbon.com';

function setTrayTitleFallback(t) {
  try { tray.setTitle(t); } catch {}
}

function buildMenu() {
  const connected = connectedState;
  const online = getOnline();

  const menu = Menu.buildFromTemplate([
    { label: connected ? 'Status: Connected' : 'Status: Not connected', enabled: false },
    { type: 'separator' },
    {
      label: 'Upload Basic to Aer (Free)',
      accelerator: 'CommandOrControl+Shift+O',
      enabled: connected && online,
      toolTip: connected ? '' : 'Connect your Aer account to enable uploads.',
      click: () => beginCapture('basic')
    },
    {
      label: 'Upload Premium to Aer (Uses Credits)',
      accelerator: 'CommandOrControl+Shift+A',
      enabled: connected && online,
      toolTip: online ? (connected ? '' : 'Connect your Aer account to enable uploads.') : 'Requires connectivity to upload and view in Aer.',
      click: () => beginCapture('premium')
    },
    { type: 'separator' },
    { label: 'View in Aer', click: () => shell.openExternal(UI_SITE_URL) },
    { label: 'Preferences…', accelerator: 'CommandOrControl+,', click: showPrefs },
    ...(connected ? [{ label: 'Sign out', click: async () => { await clearToken(); connectedState = false; rebuildUI(); } }] : []),
    { type: 'separator' },
    { label: 'Quit', accelerator: 'CommandOrControl+Q', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

function rebuildUI() {
  buildMenu();
}

async function showConnect() {
  if (connectWin) { connectWin.focus(); return; }
  connectWin = new BrowserWindow({
    width: 380,
    height: 180,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: 'Connect',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  connectWin.on('closed', () => (connectWin = null));
  connectWin.loadFile(path.join(__dirname, 'renderer', 'connect.html'));
}

function showPrefs() {
  if (prefsWin) { prefsWin.focus(); return; }
  prefsWin = new BrowserWindow({
    width: 560,
    height: 360,
    title: 'Preferences',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  prefsWin.on('closed', () => (prefsWin = null));
  prefsWin.loadFile(path.join(__dirname, 'renderer', 'prefs.html'));
}

function showOverlay() {
  if (overlayWin) { overlayWin.show(); overlayWin.focus(); return; }
  overlayWin = new BrowserWindow({
    width: 380,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    vibrancy: 'sidebar',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  overlayWin.on('closed', () => (overlayWin = null));
  overlayWin.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWin.on('moved', rememberAnchorFromCurrentApp);
  placeAtAnchorForCurrentApp();
}

async function getFrontAppKey() {
  try {
    const info = await activeWinDynamic();
    if (!info) return 'global';
    return info.bundleId || info.owner && info.owner.name || 'global';
  } catch { return 'global'; }
}

async function rememberAnchorFromCurrentApp() {
  if (!overlayWin) return;
  const key = await getFrontAppKey();
  const [x, y] = overlayWin.getPosition();
  const map = store.get('anchors', {});
  map[key] = { x, y };
  store.set('anchors', map);
}

async function placeAtAnchorForCurrentApp() {
  const key = await getFrontAppKey();
  const map = store.get('anchors', {});
  const pos = map[key];
  if (pos && overlayWin) {
    overlayWin.setPosition(Math.round(pos.x), Math.round(pos.y));
  } else {
    // default: top-right of primary screen
    const { screen } = require('electron');
    const b = screen.getPrimaryDisplay().workArea;
    if (overlayWin) overlayWin.setPosition(Math.floor(b.x + b.width - 396), Math.floor(b.y + b.height - 196));
  }
}

function toast(msg) {
  try { new Notification({ title: 'Aer', body: msg }).show(); } catch {}
}

async function beginCapture(preferred) {
  const online = getOnline();
  if (!connectedState || !online) {
    toast('Unavailable: connect your account and check internet.');
    return;
  }
  ensureKey.sync();
  // Hide any existing overlay so it doesn't appear in the screenshot
  try { if (overlayWin) { overlayWin.setIgnoreMouseEvents?.(true, { forward: true }); overlayWin.hide(); } } catch {}
  toast('Capturing screenshot …');
  try {
    const imgBuf = await captureInteractive();
    lastCaptureBuffer = imgBuf;
    // Bring back overlay as chooser after capture
    showOverlay();
    overlayWin.setIgnoreMouseEvents?.(false);
    overlayWin.webContents.send('flow:chooser', {});
    // Auto-run default or preferred
    const defaultAction = store.get('defaultAction', 'basic');
    const run = preferred || defaultAction;
    if (run === 'basic') runBasic(imgBuf); else runPremium(imgBuf);
  } catch (e) {
    // Restore overlay only if we had one; show error toast
    try { if (overlayWin) { overlayWin.setIgnoreMouseEvents?.(false); overlayWin.show(); } } catch {}
    const msg = String((e && e.message) || e || '');
    overlayWin?.webContents.send('flow:update', { stage: 'failed', title: 'Something went wrong', subtitle: msg });
    toast(msg || 'Capture failed.');
  }
}

async function runBasic(imageBuffer) {
  overlayWin?.webContents.send('flow:update', { stage: 'processing', title: 'Preparing analysis …', subtitle: 'Running local OCR' });
  try {
    const text = await runOCR(imageBuffer);
    await continueEncryptAndUpload(Buffer.from(text, 'utf8'), 'basic', text);
  } catch (e) {
    overlayWin?.webContents.send('flow:update', { stage: 'failed', title: 'Something went wrong', subtitle: String(e && e.message || e) });
  } finally {
    zeroize(imageBuffer);
    if (lastCaptureBuffer) { try { lastCaptureBuffer.fill(0); } catch {} }
    lastCaptureBuffer = null;
  }
}

async function runPremium(imageBuffer) {
  overlayWin?.webContents.send('flow:update', { stage: 'processing', title: 'Preparing analysis …', subtitle: 'Analyzing with AI in the cloud' });
  try {
    const token = await getToken();
    const baseURL = DEFAULT_BASE_URL;
    const insights = await analyzePremium(imageBuffer, token, baseURL);
    if (typeof insights === 'string') {
      const text = insights;
      await continueEncryptAndUpload(Buffer.from(text, 'utf8'), 'premium', text);
    } else {
      const json = Buffer.from(JSON.stringify(insights));
      const preview = typeof insights?.summary === 'string' ? insights.summary : '';
      await continueEncryptAndUpload(json, 'premium', preview);
    }
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    const subtitle = /Credits exhausted/i.test(msg) ? 'Credits exhausted. Use Basic or top up in your account.' : msg || 'Something went wrong';
    overlayWin?.webContents.send('flow:update', { stage: 'failed', title: 'Something went wrong', subtitle });
  } finally {
    zeroize(imageBuffer);
    if (lastCaptureBuffer) { try { lastCaptureBuffer.fill(0); } catch {} }
    lastCaptureBuffer = null;
  }
}

async function continueEncryptAndUpload(payloadBuffer, analysisType, previewPlaintext) {
  try {
    overlayWin?.webContents.send('flow:update', { stage: 'processing', title: 'Preparing analysis …', subtitle: 'Encrypting result' });
    const token = await getToken();
    const sealed = await encryptBuffer(payloadBuffer, token);
    overlayWin?.webContents.send('flow:update', { stage: 'uploading', title: 'Preparing analysis …', subtitle: 'Uploading to Aer: /api/context/upload' });
    const viewURL = await uploadEncrypted({
      sealed,
      analysisType,
      token,
      baseURL: DEFAULT_BASE_URL,
      previewPlaintext
    });
    overlayWin?.webContents.send('flow:update', { stage: 'done', title: 'Done', subtitle: 'Finalizing: deleting local screenshot.' });
    toast('Uploaded to Aer. Open: View in Aer.');
    store.set('lastUploadURL', viewURL);
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    console.error('[Upload] Error:', msg);
    overlayWin?.webContents.send('flow:update', { stage: 'failed', title: 'Something went wrong', subtitle: `Upload failed; ${msg || 'recapture when connected.'}` });
    toast(msg);
  } finally {
    zeroize(payloadBuffer);
  }
}

function zeroize(buf) { try { if (Buffer.isBuffer(buf)) buf.fill(0); } catch {} }

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (!connectedState || !getOnline()) return toast('Unavailable: connect your account and check internet.');
    beginCapture('basic');
  });
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    if (!connectedState || !getOnline()) return toast('Unavailable: connect your account and check internet.');
    beginCapture('premium');
  });
}

function setupIPC() {
  ipcMain.handle('connect:save-token', async (_e, token) => { await setToken(token); connectedState = true; store.set('connected', true); store.set('lastTokenSetAt', Date.now()); rebuildUI(); return true; });
  ipcMain.handle('connect:open-help', async () => { shell.openExternal(`${DEFAULT_BASE_URL}/help/aer-token`); });
  ipcMain.handle('overlay:choose', async (_e, which) => {
    if (!lastCaptureBuffer) return;
    if (which === 'basic') return runBasic(Buffer.from(lastCaptureBuffer));
    if (which === 'premium') return runPremium(Buffer.from(lastCaptureBuffer));
  });
  ipcMain.handle('overlay:view-in-aer', async () => { shell.openExternal(UI_SITE_URL); });
  ipcMain.handle('overlay:change-default', async () => showPrefs());
  ipcMain.handle('prefs:get', async () => ({
    connected: connectedState,
    defaultAction: store.get('defaultAction', 'basic'),
    baseURL: DEFAULT_BASE_URL
  }));
  ipcMain.handle('prefs:set', async (_e, data) => {
    if (data.defaultAction) store.set('defaultAction', data.defaultAction);
    rebuildUI();
    return true;
  });
  ipcMain.handle('prefs:signout', async () => { await clearToken(); connectedState = false; store.set('connected', false); rebuildUI(); return true; });
  ipcMain.handle('panel:close', async () => { if (overlayWin) overlayWin.hide(); });
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  setTrayTitleFallback('Aer');
  buildMenu();
}

function onOnlineChange(online) {
  if (!online) toast('No internet connection. Functionality unavailable');
  rebuildUI();
}

app.whenReady().then(async () => {
  try { if (process.platform === 'darwin' && app.dock) app.dock.hide(); } catch {}
  createTray();
  registerShortcuts();
  setupIPC();
  watchOnline(onOnlineChange);
  try { connectedState = !!(await getToken()); } catch { connectedState = false; }
  if (!connectedState) {
    // fall back to stored flag to avoid re-prompt if token storage backend is transient
    connectedState = !!store.get('connected', false);
  }
  if (!connectedState) showConnect();
});

app.on('window-all-closed', (e) => { e.preventDefault(); /* keep agent running */ });
app.on('before-quit', () => { globalShortcut.unregisterAll(); });
