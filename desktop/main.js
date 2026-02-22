const { app, BrowserWindow, dialog } = require("electron");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const net = require("net");
const path = require("path");

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

const UPDATE_REPO_OWNER = process.env.AET_UPDATE_REPO_OWNER || "nishiegroe";
const UPDATE_REPO_NAME = process.env.AET_UPDATE_REPO_NAME || "VOD-Insights";
const DEFAULT_UPDATE_FEED_URL = `https://github.com/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest/download/latest.json`;
const UPDATE_FEED_URL = process.env.AET_UPDATE_FEED_URL || DEFAULT_UPDATE_FEED_URL;

app.disableHardwareAcceleration();

let backendProcess = null;
let isQuitting = false;
let isInstallingUpdate = false;

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

function requestJson(url, timeoutMs = UPDATE_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const { statusCode = 0 } = response;
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

function downloadFile(url, destinationPath, timeoutMs = UPDATE_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const { statusCode = 0, headers } = response;
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const redirect = headers.location;
        response.resume();
        if (!redirect) {
          reject(new Error("Installer download redirect missing location."));
          return;
        }
        downloadFile(redirect, destinationPath, timeoutMs).then(resolve).catch(reject);
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

  const installerUrl = String(installer.url);
  const allowedHosts = new Set(["github.com", "objects.githubusercontent.com"]);
  const installerHost = new URL(installerUrl).hostname.toLowerCase();
  if (!allowedHosts.has(installerHost) && !installerHost.endsWith(".githubusercontent.com")) {
    throw new Error("Installer URL host is not allowed.");
  }

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
  await stopBackend();

  spawn(installerPath, [], {
    detached: true,
    windowsHide: false,
    stdio: "ignore"
  }).unref();

  app.exit(0);
}

async function maybeCheckForUpdates() {
  if (!app.isPackaged) {
    return;
  }
  if (process.platform !== "win32") {
    return;
  }
  if (String(process.env.AET_DISABLE_UPDATER || "") === "1") {
    return;
  }

  const state = loadUpdaterState();
  const now = Date.now();
  if (state.lastCheckedAt > 0 && now - state.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) {
    return;
  }

  saveUpdaterState({ lastCheckedAt: now, lastError: "" });

  let metadata;
  try {
    metadata = await requestJson(UPDATE_FEED_URL);
  } catch (error) {
    saveUpdaterState({ lastError: error instanceof Error ? error.message : String(error) });
    return;
  }

  const latestVersion = String(metadata?.version || "").trim();
  const currentVersion = app.getVersion();
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    return;
  }

  if (state.skippedVersion && state.skippedVersion === latestVersion) {
    return;
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
    return;
  }
  if (response.response !== 0) {
    return;
  }

  try {
    const installerPath = await downloadAndVerifyInstaller(metadata);
    saveUpdaterState({ skippedVersion: "", lastError: "" });
    await launchInstallerAndQuit(installerPath);
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
  }
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(windowStatePath, "utf8");
    const state = JSON.parse(raw);
    if (typeof state.width === "number" && typeof state.height === "number") {
      return {
        width: state.width,
        height: state.height,
        x: typeof state.x === "number" ? state.x : undefined,
        y: typeof state.y === "number" ? state.y : undefined,
        isMaximized: Boolean(state.isMaximized)
      };
    }
  } catch (error) {
    // Ignore missing/invalid state file.
  }
  return { width: 1600, height: 900, x: undefined, y: undefined, isMaximized: false };
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) {
    return;
  }
  const { width, height, x, y } = win.getBounds();
  const isMaximized = win.isMaximized();
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(
      windowStatePath,
      JSON.stringify({ width, height, x, y, isMaximized }, null, 2),
      "utf8"
    );
  } catch (error) {
    // Ignore write errors.
  }
}

function getRootDir() {
  return path.resolve(app.getAppPath(), "..");
}

function resolveBackendCommand() {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, "backend", "VODInsights.exe");
    return {
      command: exePath,
      args: ["--mode", "webui"],
      cwd: path.dirname(exePath)
    };
  }

  const rootDir = getRootDir();
  const venvPython = path.join(rootDir, ".venv", "Scripts", "python.exe");
  const python = fs.existsSync(venvPython) ? venvPython : "python";
  return {
    command: python,
    args: ["-m", "app.launcher", "--mode", "webui"],
    cwd: rootDir
  };
}

function waitForPort(host, port, timeoutMs = 120000, intervalMs = 500) {
  const start = Date.now();
  let lastProgressLog = start;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const now = Date.now();
      const elapsed = now - start;

      // Log progress every 10 seconds
      if (now - lastProgressLog > 10000) {
        console.log(`Still waiting for web UI (${Math.round(elapsed / 1000)}s elapsed)...`);
        lastProgressLog = now;
      }

      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve();
      });

      socket.setTimeout(5000);
      socket.on("error", () => {
        socket.destroy();
        if (elapsed > timeoutMs) {
          let errorMsg = "Timed out waiting for web UI to start (120 seconds).\n\n";
          errorMsg += "This can happen if:\n";
          errorMsg += "- Windows Defender or other antivirus is scanning the backend\n";
          errorMsg += "- Your system is under heavy load\n";
          errorMsg += "- Python dependencies are still loading\n\n";
          
          try {
            if (fs.existsSync(backendLogPath)) {
              const logText = fs.readFileSync(backendLogPath, "utf8");
              const tail = logText.split(/\r?\n/).slice(-30).join("\n");
              if (tail.trim()) {
                errorMsg += `Backend log:\n${tail}`;
              }
            } else {
              errorMsg += `No backend log found at: ${backendLogPath}`;
            }
          } catch (err) {
            errorMsg += `Error reading logs: ${err.message}`;
          }
          reject(new Error(errorMsg));
          return;
        }
        setTimeout(tryConnect, intervalMs);
      });
    };

    tryConnect();
  });
}

function startBackend() {
  const { command, args, cwd } = resolveBackendCommand();

  if (!fs.existsSync(command)) {
    throw new Error(`Backend executable not found: ${command}`);
  }

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(pyiTempDir, { recursive: true });
  const logStream = fs.createWriteStream(backendLogPath, { flags: "a" });

  backendProcess = spawn(command, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      APEX_WEBUI_WATCH: "0",
      APEX_WEBUI_PORT: String(PORT),
      AET_APPDATA_DIR: userDataDir,
      PYINSTALLER_TMPDIR: pyiTempDir,
      TEMP: pyiTempDir,
      TMP: pyiTempDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  backendProcess.stdout.on("data", (chunk) => logStream.write(chunk));
  backendProcess.stderr.on("data", (chunk) => logStream.write(chunk));
  backendProcess.on("close", () => logStream.end());

  backendProcess.on("exit", (code) => {
    if (isQuitting) {
      return;
    }
    let extra = "";
    try {
      const logText = fs.readFileSync(backendLogPath, "utf8");
      const tail = logText.split(/\r?\n/).slice(-20).join("\n");
      if (tail.trim()) {
        extra = `\n\nLast log lines:\n${tail}`;
      }
    } catch (error) {
      extra = "";
    }
    dialog.showErrorBox(
      "VOD Insights",
      `Web UI backend exited unexpectedly (code ${code}).${extra}`
    );
    app.quit();
  });
}

function cleanupPyiTempDir() {
  try {
    if (fs.existsSync(pyiTempDir)) {
      fs.rmSync(pyiTempDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup failures.
  }
}

function forceKillBackend(pid) {
  if (!pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
      return;
    }
    process.kill(pid, "SIGKILL");
  } catch (error) {
    // Ignore kill failures.
  }
}

function stopBackend() {
  return new Promise((resolve) => {
    if (!backendProcess) {
      cleanupPyiTempDir();
      resolve();
      return;
    }
    isQuitting = true;
    backendProcess.removeAllListeners("exit");
    
    const killTimeout = setTimeout(() => {
      // Force kill if graceful shutdown takes too long
      try {
        backendProcess?.kill("SIGKILL");
      } catch (error) {
        // Process might already be dead
      }
      forceKillBackend(backendProcess?.pid);
      backendProcess = null;
      cleanupPyiTempDir();
      resolve();
    }, 3000);
    
    backendProcess.on("exit", () => {
      clearTimeout(killTimeout);
      backendProcess = null;
      cleanupPyiTempDir();
      resolve();
    });
    
    // Try graceful shutdown first
    try {
      backendProcess.kill("SIGTERM");
    } catch (error) {
      // If SIGTERM fails, force kill
      clearTimeout(killTimeout);
      try {
        backendProcess.kill("SIGKILL");
      } catch (killError) {
        // Process might already be dead
      }
      forceKillBackend(backendProcess?.pid);
      backendProcess = null;
      cleanupPyiTempDir();
      resolve();
    }
  });
}

function createSplashScreen() {
  const splash = new BrowserWindow({
    width: 600,
    height: 400,
    center: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 100%;
          height: 100vh;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          overflow: hidden;
        }
        .container {
          text-align: center;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .logo {
          font-size: 48px;
          font-weight: bold;
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        .app-name {
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255, 255, 255, 0.2);
          border-top: 3px solid #ff6b35;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .status {
          font-size: 14px;
          color: #b0b0b0;
          margin-top: 10px;
          min-height: 20px;
        }
        .progress-text {
          font-size: 13px;
          color: #888;
          margin-top: 5px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">⚡</div>
        <div class="app-name">VOD Insights</div>
        <div class="spinner"></div>
        <div class="status" id="status">Starting up...</div>
        <div class="progress-text" id="progress"></div>
      </div>
      <script>
        let startTime = Date.now();
        setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          document.getElementById('progress').textContent = elapsed + 's elapsed';
        }, 500);
      </script>
    </body>
    </html>
  `;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  return splash;
}

function createWindow() {
  const lastState = loadWindowState();
  const win = new BrowserWindow({
    width: lastState.width,
    height: lastState.height,
    x: lastState.x,
    y: lastState.y,
    backgroundColor: "#111111",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);

  win.once("ready-to-show", () => {
    if (lastState.isMaximized) {
      win.maximize();
    }
    win.show();
  });

  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 200);
  };

  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("close", () => saveWindowState(win));

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      isQuitting = true;
      stopBackend().then(() => {
        win.destroy();
      });
    }
  });

  win.loadURL(`http://${HOST}:${PORT}`);
  return win;
}

app.on("before-quit", async () => {
  if (isInstallingUpdate) {
    return;
  }
  isQuitting = true;
  await stopBackend();
});

app.on("will-quit", (event) => {
  if (isInstallingUpdate) {
    return;
  }
  if (backendProcess) {
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
    await stopBackend();
  }
  app.quit();
});
