const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { createBackendSupervisor } = require("./backendSupervisor");
const { registerAppLifecycle } = require("./appLifecycle");
const { registerDesktopIpcHandlers } = require("./ipcHandlers");
const { createAssetResolvers } = require("./assetPaths");
const { createBackendApiClient } = require("./backendApiClient");
const { createBackendRuntime } = require("./backendRuntime");
const { createSplashScreenTools } = require("./splashScreen");
const { createUpdaterConfig } = require("./updaterConfig");
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
const updaterConfig = createUpdaterConfig({ processObj: process });

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

const backendRuntime = createBackendRuntime({
  backendSupervisor,
});

const assetResolvers = createAssetResolvers({
  fs,
  path,
  processObj: process,
  baseDir: __dirname,
});

const windowManager = createWindowManager({
  BrowserWindow,
  fs,
  path,
  windowStatePath,
  resolveWindowIconPath: assetResolvers.resolveWindowIconPath,
  host: HOST,
  port: PORT,
  backendSupervisor,
  stopBackend: backendRuntime.stopBackend,
  getIsQuitting: () => isQuitting,
  setIsQuitting: (value) => {
    isQuitting = value;
  }
});


const backendApiClient = createBackendApiClient({
  host: HOST,
  port: PORT,
  timeoutMs: updaterConfig.updateRequestTimeoutMs,
});

const updaterManager = createUpdaterManager({
  app,
  dialog,
  fs,
  path,
  spawn,
  processObj: process,
  backendSupervisor,
  stopBackend: backendRuntime.stopBackend,
  validateInstallerDownloadUrl,
  compareVersions,
  updaterStatePath,
  updaterDownloadDir,
  updateFeedUrl: updaterConfig.updateFeedUrl,
  updateCheckIntervalMs: updaterConfig.updateCheckIntervalMs,
  updateRequestTimeoutMs: updaterConfig.updateRequestTimeoutMs,
  updateMaxRedirects: updaterConfig.updateMaxRedirects,
});

const splashScreenTools = createSplashScreenTools({
  app,
  BrowserWindow,
  fs,
  resolveDesktopAssetPath: assetResolvers.resolveDesktopAssetPath,
  resolveWindowIconPath: assetResolvers.resolveWindowIconPath,
  requestApiJson: backendApiClient.requestApiJson,
});

registerDesktopIpcHandlers({
  ipcMain,
  updaterManager,
});

registerAppLifecycle({
  app,
  dialog,
  backendSupervisor,
  stopBackend: backendRuntime.stopBackend,
  updaterManager,
  getIsQuitting: () => isQuitting,
  setIsQuitting: (value) => {
    isQuitting = value;
  },
  createSplashScreen: splashScreenTools.createSplashScreen,
  startBackend: backendRuntime.startBackend,
  waitForPort: backendRuntime.waitForPort,
  host: HOST,
  port: PORT,
  waitForDependencyBootstrap: splashScreenTools.waitForDependencyBootstrap,
  createWindow: windowManager.createWindow,
});
