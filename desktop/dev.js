const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const electronPath = require("electron");

const rootDir = path.resolve(__dirname, "..");
const venvScripts = path.join(rootDir, ".venv", "Scripts");

if (!fs.existsSync(venvScripts)) {
  console.error(".venv\\Scripts not found. Create the venv first (see README). ");
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${venvScripts};${process.env.PATH || ""}`
};

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env,
  cwd: __dirname
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
