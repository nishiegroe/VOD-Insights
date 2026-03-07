const crypto = require("crypto");
const https = require("https");

function createUpdaterManager({
  app,
  dialog,
  fs,
  path,
  spawn,
  processObj,
  backendSupervisor,
  stopBackend,
  validateInstallerDownloadUrl,
  compareVersions,
  updaterStatePath,
  updaterDownloadDir,
  updateFeedUrl,
  updateCheckIntervalMs,
  updateRequestTimeoutMs,
  updateMaxRedirects,
}) {
  let isInstallingUpdate = false;
  let isCheckingForUpdates = false;

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

  function requestJson(url, timeoutMs = updateRequestTimeoutMs, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const transport = urlObj.protocol === "http:" ? require("http") : https;
      const request = transport.get(urlObj, (response) => {
        const { statusCode = 0, headers } = response;
        if (statusCode >= 300 && statusCode < 400 && headers?.location) {
          if (redirectCount >= updateMaxRedirects) {
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

  function downloadFile(url, destinationPath, timeoutMs = updateRequestTimeoutMs) {
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
      lastError: typeof state.lastError === "string" ? state.lastError : "",
    };
  }

  function saveUpdaterState(partial) {
    const current = loadUpdaterState();
    safeWriteJson(updaterStatePath, {
      ...current,
      ...partial,
    });
  }

  function clearDownloadedInstallers() {
    try {
      if (!fs.existsSync(updaterDownloadDir)) {
        return;
      }

      const entries = fs.readdirSync(updaterDownloadDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(updaterDownloadDir, entry.name);
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cache cleanup failures; updater can still function.
    }
  }

  function clearLegacyPythonPackages() {
    try {
      const userDataDir = path.dirname(updaterDownloadDir);
      const legacyPackagesDir = path.join(userDataDir, "python_packages");
      if (!fs.existsSync(legacyPackagesDir)) {
        return;
      }
      fs.rmSync(legacyPackagesDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup failures; this folder is not required by current runtime.
    }
  }

  function clearUserDataCaches() {
    try {
      const userDataDir = path.dirname(updaterDownloadDir);
      const cacheDirs = [
        "Cache",
        "Code Cache",
        "GPUCache",
        "DawnCache",
        "DawnGraphiteCache",
        "DawnWebGPUCache",
      ];

      for (const name of cacheDirs) {
        const dirPath = path.join(userDataDir, name);
        if (!fs.existsSync(dirPath)) {
          continue;
        }
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cache cleanup failures; these folders are recreated by Electron.
    }
  }

  function clearBootstrapDownloadCache() {
    try {
      const userDataDir = path.dirname(updaterDownloadDir);
      const bootstrapDir = path.join(userDataDir, "downloads", "bootstrap");
      if (!fs.existsSync(bootstrapDir)) {
        return;
      }

      const entries = fs.readdirSync(bootstrapDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(bootstrapDir, entry.name);
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup failures; bootstrap can redownload if needed.
    }
  }

  async function launchInstallerAndQuit(installerPath) {
    isInstallingUpdate = true;
    backendSupervisor.markQuitting();
    await stopBackend();

    spawn(installerPath, [], {
      detached: true,
      windowsHide: false,
      stdio: "ignore",
    }).unref();

    app.exit(0);
  }

  async function maybeCheckForUpdates(options = {}) {
    const {
      force = false,
      notifyIfCurrent = false,
      notifyOnError = false,
    } = options;

    if (isCheckingForUpdates) {
      return { status: "busy" };
    }

    isCheckingForUpdates = true;

    try {
      if (!app.isPackaged) {
        return { status: "not-packaged" };
      }
      if (processObj.platform !== "win32") {
        return { status: "unsupported-platform" };
      }
      if (String(processObj.env.AET_DISABLE_UPDATER || "") === "1") {
        return { status: "disabled" };
      }

      const state = loadUpdaterState();
      const now = Date.now();
      if (!force && state.lastCheckedAt > 0 && now - state.lastCheckedAt < updateCheckIntervalMs) {
        return { status: "throttled" };
      }

      saveUpdaterState({ lastCheckedAt: now, lastError: "" });

      let metadata;
      try {
        metadata = await requestJson(updateFeedUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        saveUpdaterState({ lastError: message });
        if (notifyOnError) {
          await dialog.showMessageBox({
            type: "error",
            buttons: ["OK"],
            title: "Update check failed",
            message: "Could not check for updates.",
            detail: message,
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
            message: `You are up to date (${currentVersion}).`,
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
        detail: "The installer will be downloaded, verified, and launched. You may see a Windows security prompt for an unsigned installer.",
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
          detail: message,
        });
        return { status: "install-error", error: message };
      }
    } finally {
      isCheckingForUpdates = false;
    }
  }

  async function handleUpdateAppRequest() {
    const result = await maybeCheckForUpdates({
      force: true,
      notifyIfCurrent: true,
      notifyOnError: true,
    });
    return {
      ok: true,
      ...(result || { status: "unknown" }),
    };
  }

  return {
    maybeCheckForUpdates,
    handleUpdateAppRequest,
    saveUpdaterState,
    clearDownloadedInstallers,
    clearLegacyPythonPackages,
    clearUserDataCaches,
    clearBootstrapDownloadCache,
    isInstallingUpdate: () => isInstallingUpdate,
  };
}

module.exports = {
  createUpdaterManager,
};
