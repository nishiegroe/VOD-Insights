const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = path.resolve(__dirname, "..");

function fail(message) {
  throw new Error(message);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function checkMeta() {
  const metaPath = path.join(root, "app_meta.json");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  const required = ["internalName", "displayName", "version", "appId", "publisher"];
  for (const key of required) {
    if (typeof meta[key] !== "string" || !meta[key].trim()) {
      fail(`app_meta.json missing non-empty string field: ${key}`);
    }
  }

  if (!/^[A-Za-z0-9._-]+$/.test(meta.internalName)) {
    fail("app_meta.json internalName must match ^[A-Za-z0-9._-]+$");
  }

  if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$/.test(meta.version)) {
    fail("app_meta.json version must look like semver (for example 1.2.3 or 1.2.3-beta.1)");
  }
}

function checkBuildScript() {
  const content = readText("scripts/build_inno.ps1");

  if (!content.includes('$ErrorActionPreference = "Stop"')) {
    fail('scripts/build_inno.ps1 must set $ErrorActionPreference = "Stop"');
  }

  if (!content.includes('if (-not $isccPath)')) {
    fail("scripts/build_inno.ps1 must guard against missing ISCC");
  }
}

function checkDependencyBootstrapHosts() {
  const content = readText("app/dependency_bootstrap.py");

  const allowedHosts = [
    "www.gyan.dev",
    "github.com",
    "objects.githubusercontent.com",
    "githubusercontent.com"
  ];

  for (const host of allowedHosts) {
    if (!content.includes(`\"${host}\"`) && !content.includes(`'${host}'`)) {
      fail(`app/dependency_bootstrap.py host allowlist missing expected host: ${host}`);
    }
  }

  const dependencyUrlRegex = /DependencySpec\([\s\S]*?name=\"([^\"]+)\"[\s\S]*?url=\"([^\"]*)\"[\s\S]*?kind=\"([^\"]+)\"/g;
  let match;
  let foundRequiredDownload = false;

  while ((match = dependencyUrlRegex.exec(content)) !== null) {
    const name = match[1];
    const url = match[2];
    const kind = match[3];

    if (!url) {
      continue;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail(`Dependency ${name} has invalid URL: ${url}`);
    }

    if (parsed.protocol !== "https:") {
      fail(`Dependency ${name} must use https URL: ${url}`);
    }

    const hostname = parsed.hostname.toLowerCase();
    const allowed =
      allowedHosts.includes(hostname) ||
      hostname.endsWith(".githubusercontent.com");

    if (!allowed) {
      fail(`Dependency ${name} URL host not in allowlist: ${hostname}`);
    }

    if (kind === "zip" || kind === "file") {
      foundRequiredDownload = true;
    }
  }

  if (!foundRequiredDownload) {
    fail("Could not find any download dependencies in app/dependency_bootstrap.py");
  }
}

function main() {
  checkMeta();
  checkBuildScript();
  checkDependencyBootstrapHosts();
  process.stdout.write("Build/security preflight checks passed.\n");
}

main();
