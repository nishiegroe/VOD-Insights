function registerDesktopIpcHandlers({ ipcMain, updaterManager }) {
  ipcMain.handle("desktop:update-app", () => updaterManager.handleUpdateAppRequest());
  ipcMain.handle("desktop:check-for-updates", () => updaterManager.handleUpdateAppRequest());
}

module.exports = {
  registerDesktopIpcHandlers,
};
