const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const electronPath = require("electron");

const rootDir = path.resolve(__dirname, "..");
const venvScripts = path.join(rootDir, ".venv", "Scripts");
const devPackagedBackendDir = path.join(rootDir, ".dev-packaged", "backend");
const appMetaSourcePath = path.join(rootDir, "app_meta.json");
const appMetaDestPath = path.join(devPackagedBackendDir, "app_meta.json");

if (!fs.existsSync(venvScripts)) {
  console.error(".venv\\Scripts not found. Create the venv first (see README). ");
  process.exit(1);
}

if (!fs.existsSync(appMetaSourcePath)) {
  console.error("app_meta.json not found at repo root.");
  process.exit(1);
}

fs.mkdirSync(devPackagedBackendDir, { recursive: true });
fs.copyFileSync(appMetaSourcePath, appMetaDestPath);

const env = {
  ...process.env,
  PATH: `${venvScripts};${process.env.PATH || ""}`,
  AET_INSTALL_DIR: devPackagedBackendDir,
  AET_VERSION_SOURCE_MODE: "install-meta-first"
};

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env,
  cwd: __dirname
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
