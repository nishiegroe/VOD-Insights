const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aetDesktop", {
  // Update API
  updateApp: () => ipcRenderer.invoke("desktop:update-app"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),

  // Video API (for compatibility, expose ipcRenderer for direct use)
  // The React component will use window.ipcRenderer directly for video operations
});

// Also expose ipcRenderer directly for video operations
// (used by videoClient.ts for IPC communication)
contextBridge.exposeInMainWorld("ipcRenderer", {
  // Video control methods
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Event listeners for telemetry and errors
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  once: (channel, listener) => ipcRenderer.once(channel, listener),
  off: (channel, listener) => ipcRenderer.off(channel, listener),

  // Send methods (for one-way messages if needed)
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
});
