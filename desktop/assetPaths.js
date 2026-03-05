function createAssetResolvers({ fs, path, processObj, baseDir }) {
  function resolveDesktopAssetPath(filename) {
    return path.join(baseDir, "assets", filename);
  }

  function resolveWindowIconPath() {
    const defaultIcon = resolveDesktopAssetPath("logo.png");
    if (fs.existsSync(defaultIcon)) {
      return defaultIcon;
    }
    const windowsIcon = resolveDesktopAssetPath("logo.ico");
    if (processObj.platform === "win32" && fs.existsSync(windowsIcon)) {
      return windowsIcon;
    }
    return undefined;
  }

  return {
    resolveDesktopAssetPath,
    resolveWindowIconPath,
  };
}

module.exports = {
  createAssetResolvers,
};
