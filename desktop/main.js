const { app, BrowserWindow, dialog, ipcMain } = require("electron");
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
const UPDATE_MAX_REDIRECTS = 5;

const UPDATE_REPO_OWNER = process.env.AET_UPDATE_REPO_OWNER || "nishiegroe";
const UPDATE_REPO_NAME = process.env.AET_UPDATE_REPO_NAME || "VOD-Insights";
const DEFAULT_UPDATE_FEED_URL = `https://github.com/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest/download/latest.json`;
const UPDATE_FEED_URL = process.env.AET_UPDATE_FEED_URL || DEFAULT_UPDATE_FEED_URL;

app.disableHardwareAcceleration();

let backendProcess = null;
let isQuitting = false;
let isInstallingUpdate = false;
let isCheckingForUpdates = false;

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

function updateSplashStatus(splash, statusText, dependencyName = "", percentComplete = 0) {
  if (!splash || splash.isDestroyed()) {
    return;
  }
  const escapedStatus = JSON.stringify(String(statusText || ""));
  const escapedDep = JSON.stringify(String(dependencyName || ""));
  const safePercent = Math.min(100, Math.max(0, Math.floor(percentComplete)));
  splash.webContents
    .executeJavaScript(
      `
      (function() {
        const statusEl = document.getElementById('status');
        const depEl = document.getElementById('dep');
        const barEl = document.getElementById('bar');
        const percentEl = document.getElementById('pct');
        
        if (statusEl) statusEl.textContent = ${escapedStatus};
        if (depEl) depEl.textContent = ${escapedDep};
        if (barEl) barEl.style.width = '${safePercent}%';
        if (percentEl) percentEl.textContent = '${safePercent > 0 ? safePercent + '%' : ''}';
        return true;
      })();
      `,
      true
    )
    .catch((err) => {
      console.error('Splash update error:', err);
    });
}

async function waitForDependencyBootstrap(splash) {
  if (!app.isPackaged) {
    console.log('Bootstrap skipped: app not packaged');
    return;
  }
  if (String(process.env.AET_DISABLE_BOOTSTRAP || "") === "1") {
    console.log('Bootstrap skipped: disabled via env');
    return;
  }

  console.log('Starting bootstrap check...');
  updateSplashStatus(splash, "Checking dependencies...", "Initializing...", 1);
  await new Promise(resolve => setTimeout(resolve, 100)); // Give UI time to update
  
  let status;
  try {
    status = await requestApiJson("GET", "/api/bootstrap/status");
    console.log('Bootstrap initial status:', JSON.stringify(status));
  } catch (err) {
    console.error('Failed to get initial bootstrap status:', err);
    updateSplashStatus(splash, "Error checking dependencies", err.message, 0);
    throw err;
  }
  
  if (status.gpu_ocr_ready && status.required_ready) {
    console.log('All dependencies already ready');
    updateSplashStatus(splash, "All dependencies ready!", "", 100);
    return;
  }

  updateSplashStatus(splash, "Starting dependency installation...", "Please wait...", 5);
  try {
    await requestApiJson("POST", "/api/bootstrap/start", { install_gpu_ocr: true });
    console.log('Bootstrap start requested');
  } catch (err) {
    console.error('Failed to start bootstrap:', err);
    throw err;
  }

  const startedAt = Date.now();
  const timeoutMs = 30 * 60 * 1000;
  let lastUpdateTime = startedAt;
  let totalDeps = 0;
  let completedDeps = 0;

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Dependency bootstrap timed out after 30 minutes.");
    }

    try {
      status = await requestApiJson("GET", "/api/bootstrap/status");
    } catch (err) {
      console.error('Bootstrap status check failed:', err);
      updateSplashStatus(splash, "Checking status...", "Retrying...", 5);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    
    // Calculate progress across all dependencies
    const allDeps = [
      ...(status.dependencies || []),
      ...(status.gpu_ocr_dependencies || [])
    ];
    totalDeps = allDeps.length;
    completedDeps = allDeps.filter(d => d.installed).length;
    const overallPercent = totalDeps > 0 ? Math.round((completedDeps / totalDeps) * 100) : 0;
    
    // Build detailed status message
    const allDepsReady = Boolean(status.gpu_ocr_ready && status.required_ready);
    let statusMsg = status.message || "Preparing dependencies...";
    if (!allDepsReady && statusMsg.toLowerCase().includes("ready")) {
      statusMsg = "Preparing dependencies...";
    }
    if (!status.message) {
      if (status.phase === "downloading") {
        statusMsg = "Downloading...";
      } else if (status.phase === "installing") {
        statusMsg = "Installing...";
      } else if (status.phase === "ready") {
        statusMsg = allDepsReady ? "Dependencies ready!" : "Preparing dependencies...";
      } else if (status.phase === "error") {
        statusMsg = "Setup error";
      }
    }
    
    // Show current dependency being processed
    const depName = status.dependency ? status.dependency.toUpperCase() : "";
    
    // Calculate file transfer percentage if available
    let filePercent = 0;
    if (status.bytes_total > 0) {
      filePercent = Math.round((status.bytes_downloaded / status.bytes_total) * 100);
    }
    
    // Update splash with detailed info
    let displayPercent = overallPercent;
    if (filePercent > 0 && filePercent < overallPercent * 2) {
      // If we're actively downloading, show download progress within current dep
      displayPercent = Math.round(((completedDeps - 0.5 + filePercent / 100) / totalDeps) * 100);
    }
    
    let depInfo = depName;
    if (filePercent > 0) {
      depInfo += ` (${filePercent}% downloaded)`;
    }
    
    updateSplashStatus(splash, statusMsg, depInfo, displayPercent);

    if (status.required_ready && !status.gpu_ocr_ready) {
      updateSplashStatus(
        splash,
        "GPU OCR downloading in background...",
        depInfo || "Using Tesseract for now",
        Math.max(10, displayPercent)
      );
      return;
    }
    if (status.gpu_ocr_ready && status.required_ready) {
      updateSplashStatus(splash, "All dependencies ready!", "", 100);
      return;
    }
    if (status.phase === "error") {
      throw new Error(status.error || "Dependency bootstrap failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
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

function getInstallDir() {
  // For packaged apps, the executable is in the install directory.
  // For dev, use the project root.
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  return getRootDir();
}

function startBackend() {
  const { command, args, cwd } = resolveBackendCommand();

  if (!fs.existsSync(command)) {
    throw new Error(`Backend executable not found: ${command}`);
  }

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(pyiTempDir, { recursive: true });
  const logStream = fs.createWriteStream(backendLogPath, { flags: "a" });

  const installDir = getInstallDir();
  backendProcess = spawn(command, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      APEX_WEBUI_WATCH: "0",
      APEX_WEBUI_PORT: String(PORT),
      AET_APPDATA_DIR: userDataDir,
      AET_INSTALL_DIR: installDir,
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
  const splashLogoPath = resolveDesktopAssetPath("logo.png");
  let splashLogoUrl = "";
  if (fs.existsSync(splashLogoPath)) {
    try {
      const logoBytes = fs.readFileSync(splashLogoPath);
      splashLogoUrl = `data:image/png;base64,${logoBytes.toString("base64")}`;
    } catch (error) {
      splashLogoUrl = "";
    }
  }

  const splash = new BrowserWindow({
    width: 600,
    height: 400,
    center: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    icon: resolveWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { margin: 0; padding: 0; width: 100%; height: 100vh; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
.container { text-align: center; color: white; display: flex; flex-direction: column; align-items: center; gap: 30px; width: 100%; padding: 40px; }
.header { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.logo { width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; }
.logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.app-name { font-size: 28px; font-weight: 700; color: #ffffff; }
.app-name img { display: none !important; }
.spinner { width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.15); border-top: 3px solid #ff6b35; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
.status { font-size: 14px; color: #b0b0b0; min-height: 20px; }
.dep { font-size: 12px; color: #ff6b35; font-weight: 600; }
.progress { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; }
.bar { height: 100%; background: linear-gradient(90deg, #ff6b35 0%, #ff8955 100%); width: 0%; transition: width 0.3s ease; }
.info { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 11px; color: #888; }
.estimate { font-size: 11px; color: #555; margin-top: 8px; font-style: italic; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
<div class="header">
<div class="logo">${splashLogoUrl ? `<img src="${splashLogoUrl}" alt="VOD Insights logo" />` : "🔍"}</div>
<div class="app-name">${splashLogoUrl ? `<img src="${splashLogoUrl}" alt="" />` : ""}<span>VOD Insights</span></div>
</div>
<div class="spinner"></div>
<div class="status" id="status">Starting up...</div>
<div class="dep" id="dep"></div>
<div class="progress"><div class="bar" id="bar"></div></div>
<div class="info"><span id="pct">0%</span><span id="time">0s elapsed</span></div>
<div class="estimate">This may take 5-10 minutes or more depending on PC specs</div>
</div>
<script>
let start = Date.now();
setInterval(() => {
const s = Math.round((Date.now() - start) / 1000);
const m = Math.floor(s / 60);
const sec = s % 60;
document.getElementById('time').textContent = m > 0 ? m + 'm ' + sec + 's' : sec + 's';
}, 500);
</script>
</body>
</html>
  `));

  return splash;
}

function createWindow() {
  const lastState = loadWindowState();
  const win = new BrowserWindow({
    width: lastState.width,
    height: lastState.height,
    x: lastState.x,
    y: lastState.y,
    icon: resolveWindowIconPath(),
    backgroundColor: "#111111",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
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
    await stopBackend();
  }
  app.quit();
});
