import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('aer', {
  loadConfig: () => ipcRenderer.invoke('cfg:load'),
  saveConfig: (cfg: any) => ipcRenderer.invoke('cfg:save', cfg),
  listHistory: () => ipcRenderer.invoke('history:list'),
  captureNow: () => ipcRenderer.invoke('capture:run'),
  openSettingsPage: () => ipcRenderer.invoke('open:settings'),
})
