const { EventEmitter } = require("events");

function createBackendSupervisor({
  app,
  dialog,
  fs,
  net,
  path,
  spawn,
  spawnSync,
  processObj,
  HOST,
  PORT,
  userDataDir,
  backendLogPath,
  pyiTempDir
}) {
  let backendProcess = null;
  let isQuitting = false;
  const events = new EventEmitter();

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
    if (app.isPackaged) {
      return path.dirname(process.execPath);
    }
    return getRootDir();
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
      if (processObj.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
        return;
      }
      processObj.kill(pid, "SIGKILL");
    } catch (error) {
      // Ignore kill failures.
    }
  }

  function startBackend() {
    const { command, args, cwd } = resolveBackendCommand();

    const commandLooksLikePath = path.isAbsolute(command) || command.includes("\\") || command.includes("/");
    if (commandLooksLikePath && !fs.existsSync(command)) {
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
        ...processObj.env,
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

    events.emit("started", { pid: backendProcess.pid, host: HOST, port: PORT });
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

      try {
        backendProcess.kill("SIGTERM");
      } catch (error) {
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

  function markQuitting() {
    isQuitting = true;
  }

  function getState() {
    return { backendProcess, isQuitting };
  }

  return {
    events,
    getState,
    markQuitting,
    startBackend,
    stopBackend,
    waitForPort
  };
}

module.exports = { createBackendSupervisor };
