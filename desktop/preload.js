const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aetDesktop", {
  updateApp: () => ipcRenderer.invoke("desktop:update-app"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates")
});
