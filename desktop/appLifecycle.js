function registerAppLifecycle({
  app,
  dialog,
  backendSupervisor,
  stopBackend,
  updaterManager,
  getIsQuitting,
  setIsQuitting,
  createSplashScreen,
  startBackend,
  waitForPort,
  host,
  port,
  waitForDependencyBootstrap,
  createWindow,
}) {
  app.on("before-quit", async () => {
    if (updaterManager.isInstallingUpdate()) {
      return;
    }
    setIsQuitting(true);
    backendSupervisor.markQuitting();
    await stopBackend();
  });

  app.on("will-quit", (event) => {
    if (updaterManager.isInstallingUpdate()) {
      return;
    }
    if (backendSupervisor.getState().backendProcess) {
      event.preventDefault();
      stopBackend().then(() => {
        app.exit(0);
      });
    }
  });

  app.whenReady().then(async () => {
    let splash = null;
    try {
      updaterManager.clearDownloadedInstallers();
      updaterManager.clearLegacyPythonPackages();
      updaterManager.clearUserDataCaches();
      updaterManager.clearBootstrapDownloadCache();
      splash = createSplashScreen();
      startBackend();
      await waitForPort(host, port);
      await waitForDependencyBootstrap(splash);
      const win = createWindow();

      win.once("ready-to-show", () => {
        if (splash && !splash.isDestroyed()) {
          splash.destroy();
        }
        setTimeout(() => {
          updaterManager.maybeCheckForUpdates().catch((error) => {
            updaterManager.saveUpdaterState({
              lastError: error instanceof Error ? error.message : String(error),
            });
          });
        }, 5000);
      });
    } catch (error) {
      if (splash && !splash.isDestroyed()) {
        splash.destroy();
      }
      dialog.showErrorBox(
      "VOD Insights",
        error instanceof Error ? error.message : "Failed to start web UI."
      );
      app.quit();
    }
  });

  app.on("window-all-closed", async () => {
    if (!getIsQuitting()) {
      setIsQuitting(true);
      backendSupervisor.markQuitting();
      await stopBackend();
    }
    app.quit();
  });
}

module.exports = {
  registerAppLifecycle,
};
