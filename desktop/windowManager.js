function createWindowManager({
  BrowserWindow,
  fs,
  path,
  windowStatePath,
  resolveWindowIconPath,
  host,
  port,
  backendSupervisor,
  stopBackend,
  getIsQuitting,
  setIsQuitting,
}) {
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
          isMaximized: Boolean(state.isMaximized),
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
      fs.mkdirSync(path.dirname(windowStatePath), { recursive: true });
      fs.writeFileSync(
        windowStatePath,
        JSON.stringify({ width, height, x, y, isMaximized }, null, 2),
        "utf8"
      );
    } catch (error) {
      // Ignore write errors.
    }
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
        preload: path.join(__dirname, "preload.js"),
      },
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
      if (!getIsQuitting()) {
        event.preventDefault();
        setIsQuitting(true);
        backendSupervisor.markQuitting();
        stopBackend().then(() => {
          win.destroy();
        });
      }
    });

    win.loadURL(`http://${host}:${port}`);
    return win;
  }

  return {
    createWindow,
  };
}

module.exports = {
  createWindowManager,
};
