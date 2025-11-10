const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aer', {
  // Connect
  saveToken: (token) => ipcRenderer.invoke('connect:save-token', token),
  openHelp: () => ipcRenderer.invoke('connect:open-help'),
  openConnect: () => ipcRenderer.invoke('open:connect'),

  // Overlay
  onFlowUpdate: (cb) => ipcRenderer.on('flow:update', (_e, payload) => cb(payload)),
  onChooser: (cb) => ipcRenderer.on('flow:chooser', (_e, payload) => cb(payload)),
  choose: (which) => ipcRenderer.invoke('overlay:choose', which),
  viewInAer: () => ipcRenderer.invoke('overlay:view-in-aer'),
  changeDefault: () => ipcRenderer.invoke('overlay:change-default'),
  closePanel: () => ipcRenderer.invoke('panel:close'),

  // Prefs
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (data) => ipcRenderer.invoke('prefs:set', data),
  signOut: () => ipcRenderer.invoke('prefs:signout')
});
