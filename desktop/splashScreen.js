function createSplashScreenTools({
  app,
  BrowserWindow,
  fs,
  resolveDesktopAssetPath,
  resolveWindowIconPath,
  requestApiJson,
}) {
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
        console.error("Splash update error:", err);
      });
  }

  async function waitForDependencyBootstrap(splash) {
    if (!app.isPackaged) {
      console.log("Bootstrap skipped: app not packaged");
      return;
    }
    if (String(process.env.AET_DISABLE_BOOTSTRAP || "") === "1") {
      console.log("Bootstrap skipped: disabled via env");
      return;
    }

    console.log("Starting bootstrap check...");
    updateSplashStatus(splash, "Checking dependencies...", "Initializing...", 1);
    await new Promise((resolve) => setTimeout(resolve, 100));

    let status;
    try {
      status = await requestApiJson("GET", "/api/bootstrap/status");
      console.log("Bootstrap initial status:", JSON.stringify(status));
    } catch (err) {
      console.error("Failed to get initial bootstrap status:", err);
      updateSplashStatus(splash, "Error checking dependencies", err.message, 0);
      throw err;
    }

    if (status.gpu_ocr_ready && status.required_ready) {
      console.log("All dependencies already ready");
      updateSplashStatus(splash, "All dependencies ready!", "", 100);
      return;
    }

    updateSplashStatus(splash, "Starting dependency installation...", "Please wait...", 5);
    try {
      await requestApiJson("POST", "/api/bootstrap/start", { install_gpu_ocr: true });
      console.log("Bootstrap start requested");
    } catch (err) {
      console.error("Failed to start bootstrap:", err);
      throw err;
    }

    const startedAt = Date.now();
    const timeoutMs = 30 * 60 * 1000;
    let totalDeps = 0;
    let completedDeps = 0;

    while (true) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Dependency bootstrap timed out after 30 minutes.");
      }

      try {
        status = await requestApiJson("GET", "/api/bootstrap/status");
      } catch (err) {
        console.error("Bootstrap status check failed:", err);
        updateSplashStatus(splash, "Checking status...", "Retrying...", 5);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      const allDeps = [
        ...(status.dependencies || []),
        ...(status.gpu_ocr_dependencies || []),
      ];
      totalDeps = allDeps.length;
      completedDeps = allDeps.filter((d) => d.installed).length;
      const overallPercent = totalDeps > 0 ? Math.round((completedDeps / totalDeps) * 100) : 0;

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

      const depName = status.dependency ? status.dependency.toUpperCase() : "";

      let filePercent = 0;
      if (status.bytes_total > 0) {
        filePercent = Math.round((status.bytes_downloaded / status.bytes_total) * 100);
      }

      let displayPercent = overallPercent;
      if (filePercent > 0 && filePercent < overallPercent * 2) {
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
        nodeIntegration: false,
      },
    });

    splash.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`
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

  return {
    createSplashScreen,
    waitForDependencyBootstrap,
  };
}

module.exports = {
  createSplashScreenTools,
};
