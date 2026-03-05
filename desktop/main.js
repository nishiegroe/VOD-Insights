const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { createBackendSupervisor } = require("./backendSupervisor");
const { createBackendApiClient } = require("./backendApiClient");
const { createSplashScreenTools } = require("./splashScreen");
const { createUpdaterManager } = require("./updaterManager");
const { validateInstallerDownloadUrl } = require("./updateUrlPolicy");
const { compareVersions } = require("./versionUtils");
const { createWindowManager } = require("./windowManager");

const userDataDir = app.getPath("userData");
const backendLogPath = path.join(userDataDir, "backend.log");
const windowStatePath = path.join(userDataDir, "window-state.json");
const pyiTempDir = path.join(userDataDir, "pyi-temp");
const updaterStatePath = path.join(userDataDir, "updater-state.json");
const updaterDownloadDir = path.join(userDataDir, "updates");

const HOST = "127.0.0.1";
const PORT = parseInt(process.env.APEX_WEBUI_PORT || "5170", 10);
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_REQUEST_TIMEOUT_MS = 30000;
const UPDATE_MAX_REDIRECTS = 5;

const UPDATE_REPO_OWNER = process.env.AET_UPDATE_REPO_OWNER || "nishiegroe";
const UPDATE_REPO_NAME = process.env.AET_UPDATE_REPO_NAME || "VOD-Insights";
const DEFAULT_UPDATE_FEED_URL = `https://github.com/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest/download/latest.json`;
const UPDATE_FEED_URL = process.env.AET_UPDATE_FEED_URL || DEFAULT_UPDATE_FEED_URL;

app.disableHardwareAcceleration();

let isQuitting = false;

const backendSupervisor = createBackendSupervisor({
  app,
  dialog,
  fs,
  net,
  path,
  spawn,
  spawnSync,
  processObj: process,
  HOST,
  PORT,
  userDataDir,
  backendLogPath,
  pyiTempDir
});

const windowManager = createWindowManager({
  BrowserWindow,
  fs,
  path,
  windowStatePath,
  resolveWindowIconPath,
  host: HOST,
  port: PORT,
  backendSupervisor,
  stopBackend,
  getIsQuitting: () => isQuitting,
  setIsQuitting: (value) => {
    isQuitting = value;
  }
});

function resolveDesktopAssetPath(filename) {
  return path.join(__dirname, "assets", filename);
}

function resolveWindowIconPath() {
  const defaultIcon = resolveDesktopAssetPath("logo.png");
  if (fs.existsSync(defaultIcon)) {
    return defaultIcon;
  }
  const windowsIcon = resolveDesktopAssetPath("logo.ico");
  if (process.platform === "win32" && fs.existsSync(windowsIcon)) {
    return windowsIcon;
  }
  return undefined;
}


const backendApiClient = createBackendApiClient({
  host: HOST,
  port: PORT,
  timeoutMs: UPDATE_REQUEST_TIMEOUT_MS,
});

const updaterManager = createUpdaterManager({
  app,
  dialog,
  fs,
  path,
  spawn,
  processObj: process,
  backendSupervisor,
  stopBackend,
  validateInstallerDownloadUrl,
  compareVersions,
  updaterStatePath,
  updaterDownloadDir,
  updateFeedUrl: UPDATE_FEED_URL,
  updateCheckIntervalMs: UPDATE_CHECK_INTERVAL_MS,
  updateRequestTimeoutMs: UPDATE_REQUEST_TIMEOUT_MS,
  updateMaxRedirects: UPDATE_MAX_REDIRECTS,
});

function startBackend() {
  backendSupervisor.startBackend();
}

function waitForPort(host, port, timeoutMs = 120000, intervalMs = 500) {
  return backendSupervisor.waitForPort(host, port, timeoutMs, intervalMs);
}

function stopBackend() {
  return backendSupervisor.stopBackend();
}

const splashScreenTools = createSplashScreenTools({
  app,
  BrowserWindow,
  fs,
  resolveDesktopAssetPath,
  resolveWindowIconPath,
  requestApiJson: backendApiClient.requestApiJson,
});

function createSplashScreen() {
  return splashScreenTools.createSplashScreen();
}

function waitForDependencyBootstrap(splash) {
  return splashScreenTools.waitForDependencyBootstrap(splash);
}

function createWindow() {
  return windowManager.createWindow();
}

ipcMain.handle("desktop:update-app", () => updaterManager.handleUpdateAppRequest());
ipcMain.handle("desktop:check-for-updates", () => updaterManager.handleUpdateAppRequest());

app.on("before-quit", async () => {
  if (updaterManager.isInstallingUpdate()) {
    return;
  }
  isQuitting = true;
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
    splash = createSplashScreen();
    startBackend();
    await waitForPort(HOST, PORT);
    await waitForDependencyBootstrap(splash);
    const win = createWindow();
    
    // Close splash when main window is ready
    win.once("ready-to-show", () => {
      if (splash && !splash.isDestroyed()) {
        splash.destroy();
      }
      setTimeout(() => {
        updaterManager.maybeCheckForUpdates().catch((error) => {
          updaterManager.saveUpdaterState({ lastError: error instanceof Error ? error.message : String(error) });
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
  if (!isQuitting) {
    isQuitting = true;
    backendSupervisor.markQuitting();
    await stopBackend();
  }
  app.quit();
});
