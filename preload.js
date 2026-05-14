const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  getVersions: () => ipcRenderer.invoke('api:getVersions'),
  checkAuth: (token) => ipcRenderer.invoke('api:checkAuth', token),
  login: (username, password) => ipcRenderer.invoke('api:login', username, password),
  logout: () => ipcRenderer.invoke('api:logout'),

  runGame: (version, nickname) =>
    ipcRenderer.invoke('launcher:launchMinecraft', { versionId: version, nickname }),
  openMinecraftFolder: () => ipcRenderer.invoke('launcher:openMinecraftFolder'),
  openLogs: () => ipcRenderer.invoke('launcher:openLogs'),

  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    clearProfile: () => ipcRenderer.invoke('store:clearProfile'),
  },
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
});
