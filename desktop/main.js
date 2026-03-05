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
  return assetResolvers.resolveDesktopAssetPath(filename);
}

function resolveWindowIconPath() {
  return assetResolvers.resolveWindowIconPath();
}

const assetResolvers = createAssetResolvers({
  fs,
  path,
  processObj: process,
  baseDir: __dirname,
});


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

registerDesktopIpcHandlers({
  ipcMain,
  updaterManager,
});

registerAppLifecycle({
  app,
  dialog,
  backendSupervisor,
  stopBackend,
  updaterManager,
  getIsQuitting: () => isQuitting,
  setIsQuitting: (value) => {
    isQuitting = value;
  },
  createSplashScreen,
  startBackend,
  waitForPort,
  host: HOST,
  port: PORT,
  waitForDependencyBootstrap,
  createWindow,
});
