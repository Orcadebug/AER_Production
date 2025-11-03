import { app, BrowserWindow, Tray, Menu, ipcMain, Notification, globalShortcut, nativeImage, shell } from 'electron'
import path from 'node:path'
import log from 'electron-log'
import { captureEntireScreen } from './lib/capture'
import { ocrImageToText } from './lib/ocr'
import { sendToAer } from './lib/uploader'
import { loadConfig, saveConfig, addHistoryEntry, loadHistory } from './lib/store'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const DEFAULT_HOTKEY = 'CommandOrControl+Alt+Y'

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
    },
    title: 'Aer Capture',
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }
}

function createTray() {
  const icon = nativeImage.createEmpty() // replace with real icon if available
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow?.show() },
    { label: 'Capture Screen', click: () => handleCapture() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
  tray.setToolTip('Aer Capture')
  tray.setContextMenu(contextMenu)
}

async function handleCapture() {
  try {
    const cfg = await loadConfig()
    if (!cfg.token) {
      new Notification({ title: 'Aer Capture', body: 'Please set your Aer token in Settings.' }).show()
      mainWindow?.show()
      return
    }

    const image = await captureEntireScreen()
    const text = await ocrImageToText(image)

    const payload = {
      title: 'Screenshot capture',
      plaintext: text || '',
      metadata: {
        ts: Date.now(),
        source: 'desktop',
      },
    }

    const res = await sendToAer(payload, cfg)

    await addHistoryEntry({
      id: String(Date.now()),
      ok: res.ok,
      textPreview: (text || '').slice(0, 200),
      createdAt: Date.now(),
    })

    new Notification({ title: 'Aer Capture', body: res.ok ? 'Context saved to Aer!' : 'Failed to save (see logs).' }).show()
  } catch (e: any) {
    log.error('Capture failed', e)
    new Notification({ title: 'Aer Capture', body: 'Capture failed. Check logs.' }).show()
  }
}

app.whenReady().then(async () => {
  await createWindow()
  createTray()

  // Hotkey
  globalShortcut.register(DEFAULT_HOTKEY, () => handleCapture())

  // IPC
  ipcMain.handle('cfg:load', async () => loadConfig())
  ipcMain.handle('cfg:save', async (_e, cfg) => saveConfig(cfg))
  ipcMain.handle('history:list', async () => loadHistory())
  ipcMain.handle('capture:run', async () => {
    await handleCapture()
    return { ok: true }
  })
  ipcMain.handle('open:settings', async () => {
    const url = process.env.SITE_URL || 'https://www.aercarbon.com/settings'
    await shell.openExternal(url)
    return { ok: true }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
