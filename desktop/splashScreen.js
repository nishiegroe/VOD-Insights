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
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden}
body{background:#1c1c1e;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff}
.container{width:340px;display:flex;flex-direction:column;align-items:center}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:36px}
.brand-logo{width:48px;height:48px;flex-shrink:0}
.brand-logo img{width:100%;height:100%;object-fit:contain;display:block}
.brand-logo-emoji{font-size:36px;line-height:1}
.brand-name{font-size:26px;font-weight:700;letter-spacing:-0.3px;color:#fff}
.spinner{width:34px;height:34px;border:2.5px solid rgba(255,255,255,0.1);border-top-color:#ff6b35;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;margin-bottom:28px}
.status-block{width:100%;text-align:center;margin-bottom:24px;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
#status{font-size:13px;color:#8e8e93}
#dep{font-size:12px;font-weight:600;color:#ff6b35;min-height:16px}
.progress-block{width:100%}
.track{width:100%;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden}
.bar{height:100%;background:linear-gradient(90deg,#ff6b35,#ff9f6b);width:0%;transition:width 0.35s ease;border-radius:2px}
.meta{display:flex;justify-content:space-between;margin-top:7px}
.meta span{font-size:11px;color:#48484a}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="container">
<div class="brand">
<div class="brand-logo">${splashLogoUrl ? `<img src="${splashLogoUrl}" alt="" />` : `<span class="brand-logo-emoji">🔍</span>`}</div>
<div class="brand-name">VOD Insights</div>
</div>
<div class="spinner"></div>
<div class="status-block">
<div id="status">Starting up...</div>
<div id="dep"></div>
</div>
<div class="progress-block">
<div class="track"><div class="bar" id="bar"></div></div>
<div class="meta"><span id="pct"></span><span id="time">0s</span></div>
</div>
</div>
<script>
let start=Date.now();
setInterval(()=>{
const s=Math.round((Date.now()-start)/1000);
const m=Math.floor(s/60),sec=s%60;
document.getElementById('time').textContent=m>0?m+'m '+sec+'s':sec+'s';
},500);
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
