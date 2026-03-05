const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const net = require("net");
const path = require("path");
const { createBackendSupervisor } = require("./backendSupervisor");
const { createSplashScreenTools } = require("./splashScreen");
const { validateInstallerDownloadUrl } = require("./updateUrlPolicy");
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
let isInstallingUpdate = false;
let isCheckingForUpdates = false;

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

function safeReadJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

function safeWriteJson(filePath, value) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch (error) {
    // Ignore updater state write errors.
  }
}

function parseSemver(version) {
  const normalized = String(version || "").trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ""
  };
}

function compareVersions(a, b) {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) {
    return 0;
  }
  if (parsedA.major !== parsedB.major) return parsedA.major - parsedB.major;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor - parsedB.minor;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch - parsedB.patch;

  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  return parsedA.prerelease.localeCompare(parsedB.prerelease);
}

function requestJson(url, timeoutMs = UPDATE_REQUEST_TIMEOUT_MS, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "http:" ? require("http") : https;
    const request = transport.get(urlObj, (response) => {
      const { statusCode = 0, headers } = response;
      if (statusCode >= 300 && statusCode < 400 && headers?.location) {
        if (redirectCount >= UPDATE_MAX_REDIRECTS) {
          response.resume();
          reject(new Error("Update feed request exceeded redirect limit."));
          return;
        }
        const nextUrl = new URL(headers.location, urlObj).toString();
        response.resume();
        requestJson(nextUrl, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Update feed request failed with status ${statusCode}.`));
        return;
      }

      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        raw += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error("Invalid update metadata received."));
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Update metadata request timed out."));
    });
    request.on("error", (error) => {
      reject(error);
    });
  });
}

function requestApiJson(method, pathName, payload = null, timeoutMs = UPDATE_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const req = httpRequest(
      {
        host: HOST,
        port: PORT,
        path: pathName,
        method,
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body)
            }
          : undefined
      },
      (res) => {
        const { statusCode = 0 } = res;
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Request ${pathName} failed with status ${statusCode}.`));
            return;
          }
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (error) {
            reject(new Error(`Invalid JSON response from ${pathName}.`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timed out: ${pathName}`));
    });
    req.on("error", (error) => reject(error));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function httpRequest(options, callback) {
  return require("http").request(options, callback);
}

function downloadFile(url, destinationPath, timeoutMs = UPDATE_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let requestUrl;
    try {
      requestUrl = validateInstallerDownloadUrl(url).toString();
    } catch (error) {
      reject(error);
      return;
    }

    const request = https.get(requestUrl, (response) => {
      const { statusCode = 0, headers } = response;
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const redirect = headers.location;
        response.resume();
        if (!redirect) {
          reject(new Error("Installer download redirect missing location."));
          return;
        }
        const redirectUrl = new URL(redirect, requestUrl).toString();
        downloadFile(redirectUrl, destinationPath, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Installer download failed with status ${statusCode}.`));
        return;
      }

      const file = fs.createWriteStream(destinationPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(destinationPath));
      });
      file.on("error", (error) => {
        file.close(() => {
          try {
            fs.rmSync(destinationPath, { force: true });
          } catch (cleanupError) {
            // Ignore cleanup failures.
          }
          reject(error);
        });
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Installer download timed out."));
    });
    request.on("error", (error) => {
      try {
        fs.rmSync(destinationPath, { force: true });
      } catch (cleanupError) {
        // Ignore cleanup failures.
      }
      reject(error);
    });
  });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function downloadAndVerifyInstaller(metadata) {
  const installer = metadata?.installer;
  if (!installer || !installer.url || !installer.name || !installer.sha256) {
    throw new Error("Update metadata is missing installer fields.");
  }

  const installerUrl = validateInstallerDownloadUrl(String(installer.url)).toString();

  fs.mkdirSync(updaterDownloadDir, { recursive: true });
  const partialPath = path.join(updaterDownloadDir, `${installer.name}.part`);
  const finalPath = path.join(updaterDownloadDir, installer.name);

  if (fs.existsSync(partialPath)) {
    fs.rmSync(partialPath, { force: true });
  }

  await downloadFile(installerUrl, partialPath);
  const checksum = await sha256File(partialPath);
  if (checksum.toLowerCase() !== String(installer.sha256).toLowerCase()) {
    fs.rmSync(partialPath, { force: true });
    throw new Error("Installer checksum verification failed.");
  }

  if (fs.existsSync(finalPath)) {
    fs.rmSync(finalPath, { force: true });
  }
  fs.renameSync(partialPath, finalPath);
  return finalPath;
}

function loadUpdaterState() {
  const state = safeReadJson(updaterStatePath, {});
  return {
    skippedVersion: typeof state.skippedVersion === "string" ? state.skippedVersion : "",
    lastCheckedAt: typeof state.lastCheckedAt === "number" ? state.lastCheckedAt : 0,
    lastError: typeof state.lastError === "string" ? state.lastError : ""
  };
}

function saveUpdaterState(partial) {
  const current = loadUpdaterState();
  safeWriteJson(updaterStatePath, {
    ...current,
    ...partial
  });
}

async function launchInstallerAndQuit(installerPath) {
  isInstallingUpdate = true;
  isQuitting = true;
  backendSupervisor.markQuitting();
  await stopBackend();

  spawn(installerPath, [], {
    detached: true,
    windowsHide: false,
    stdio: "ignore"
  }).unref();

  app.exit(0);
}

async function maybeCheckForUpdates(options = {}) {
  const {
    force = false,
    notifyIfCurrent = false,
    notifyOnError = false
  } = options;

  if (isCheckingForUpdates) {
    return { status: "busy" };
  }

  isCheckingForUpdates = true;

  try {
  if (!app.isPackaged) {
    return { status: "not-packaged" };
  }
  if (process.platform !== "win32") {
    return { status: "unsupported-platform" };
  }
  if (String(process.env.AET_DISABLE_UPDATER || "") === "1") {
    return { status: "disabled" };
  }

  const state = loadUpdaterState();
  const now = Date.now();
  if (!force && state.lastCheckedAt > 0 && now - state.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) {
    return { status: "throttled" };
  }

  saveUpdaterState({ lastCheckedAt: now, lastError: "" });

  let metadata;
  try {
    metadata = await requestJson(UPDATE_FEED_URL);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    saveUpdaterState({ lastError: message });
    if (notifyOnError) {
      await dialog.showMessageBox({
        type: "error",
        buttons: ["OK"],
        title: "Update check failed",
        message: "Could not check for updates.",
        detail: message
      });
    }
    return { status: "metadata-error", error: message };
  }

  const latestVersion = String(metadata?.version || "").trim();
  const currentVersion = app.getVersion();
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    if (notifyIfCurrent) {
      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        title: "No updates available",
        message: `You are up to date (${currentVersion}).`
      });
    }
    return { status: "up-to-date", version: currentVersion };
  }

  if (!force && state.skippedVersion && state.skippedVersion === latestVersion) {
    return { status: "skipped-version", version: latestVersion };
  }

  const response = await dialog.showMessageBox({
    type: "info",
    buttons: ["Install now", "Later", "Skip this version"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: "Update available",
    message: `A new version of VOD Insights is available (${latestVersion}).`,
    detail: "The installer will be downloaded, verified, and launched. You may see a Windows security prompt for an unsigned installer."
  });

  if (response.response === 2) {
    saveUpdaterState({ skippedVersion: latestVersion });
    return { status: "skipped-now", version: latestVersion };
  }
  if (response.response !== 0) {
    return { status: "deferred", version: latestVersion };
  }

  try {
    const installerPath = await downloadAndVerifyInstaller(metadata);
    saveUpdaterState({ skippedVersion: "", lastError: "" });
    await launchInstallerAndQuit(installerPath);
    return { status: "installing", version: latestVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    saveUpdaterState({ lastError: message });
    await dialog.showMessageBox({
      type: "error",
      buttons: ["OK"],
      title: "Update failed",
      message: "Failed to download or verify the update.",
      detail: message
    });
    return { status: "install-error", error: message };
  }
  } finally {
    isCheckingForUpdates = false;
  }
}

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
  requestApiJson,
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

async function handleUpdateAppRequest() {
  const result = await maybeCheckForUpdates({
    force: true,
    notifyIfCurrent: true,
    notifyOnError: true
  });
  return {
    ok: true,
    ...(result || { status: "unknown" })
  };
}

ipcMain.handle("desktop:update-app", handleUpdateAppRequest);
ipcMain.handle("desktop:check-for-updates", handleUpdateAppRequest);

app.on("before-quit", async () => {
  if (isInstallingUpdate) {
    return;
  }
  isQuitting = true;
  backendSupervisor.markQuitting();
  await stopBackend();
});

app.on("will-quit", (event) => {
  if (isInstallingUpdate) {
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
        maybeCheckForUpdates().catch((error) => {
          saveUpdaterState({ lastError: error instanceof Error ? error.message : String(error) });
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
