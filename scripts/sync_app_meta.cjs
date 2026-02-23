const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function replaceOrThrow(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${label}`);
  }
  return content.replace(pattern, replacement);
}

function toNpmName(displayName) {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function syncLogoAsset(filename) {
  const candidates = [
    path.join(root, "assets", "branding", filename),
    path.join(root, "frontend", "public", filename),
    path.join(root, "desktop", "assets", filename)
  ];

  const existing = candidates
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }));

  if (!existing.length) {
    process.stdout.write(`No ${filename} found to sync.\n`);
    return;
  }

  const [latest] = existing.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const sourcePath = latest.filePath;

  for (const targetPath of candidates) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (path.resolve(targetPath) === path.resolve(sourcePath)) {
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }

  process.stdout.write(`Synced ${filename} from ${path.relative(root, sourcePath)}\n`);
}

function syncBrandingAssets() {
  syncLogoAsset("logo.png");
  syncLogoAsset("logo.ico");
}

function syncDesktopPackage(meta) {
  const filePath = path.join(root, "desktop", "package.json");
  const pkg = readJson(filePath);
  pkg.version = meta.version;
  pkg.name = `${toNpmName(meta.displayName)}-desktop`;
  pkg.build = pkg.build || {};
  pkg.build.appId = meta.appId;
  pkg.build.productName = meta.displayName;
  pkg.build.extraResources = (pkg.build.extraResources || []).map((entry) => {
    if (entry && entry.from && /^\.\.\\?\/dist\//.test(entry.from)) {
      return { ...entry, from: `../dist/${meta.internalName}` };
    }
    return entry;
  });
  writeJson(filePath, pkg);
}

function syncFrontendPackage(meta) {
  const filePath = path.join(root, "frontend", "package.json");
  const pkg = readJson(filePath);
  pkg.version = meta.version;
  writeJson(filePath, pkg);
}

function syncRootPackage(meta) {
  const filePath = path.join(root, "package.json");
  const pkg = readJson(filePath);
  pkg.version = meta.version;
  writeJson(filePath, pkg);
}

function syncPyInstallerSpec(meta) {
  const filePath = path.join(root, "apex_event_tracker.spec");
  let content = fs.readFileSync(filePath, "utf8");
  content = replaceOrThrow(content, /name="[^"]+",\r?\n\s*debug=False,/, `name="${meta.internalName}",\n    debug=False,`, "EXE name in spec");
  content = replaceOrThrow(content, /name="[^"]+",\r?\n\)/, `name="${meta.internalName}",\n)`, "COLLECT name in spec");
  writeText(filePath, content);
}

function syncInnoScript(meta) {
  const filePath = path.join(root, "inno", "VODInsights.iss");
  let content = fs.readFileSync(filePath, "utf8");
  const desktopExeName = `${meta.displayName}.exe`;
  content = replaceOrThrow(content, /#define MyAppName ".*"/, `#define MyAppName "${meta.displayName}"`, "MyAppName define");
  content = replaceOrThrow(content, /#define MyAppVersion ".*"/, `#define MyAppVersion "${meta.version}"`, "MyAppVersion define");
  content = replaceOrThrow(content, /#define MyAppPublisher ".*"/, `#define MyAppPublisher "${meta.publisher}"`, "MyAppPublisher define");
  content = replaceOrThrow(content, /#define MyAppExeName ".*"/, `#define MyAppExeName "${desktopExeName}"`, "MyAppExeName define");
  writeText(filePath, content);
}

function syncRuntimePaths(meta) {
  const filePath = path.join(root, "app", "runtime_paths.py");
  let content = fs.readFileSync(filePath, "utf8");
  content = replaceOrThrow(content, /^APP_NAME = ".*"/m, `APP_NAME = "${meta.internalName}"`, "APP_NAME constant");
  writeText(filePath, content);
}

function syncDesktopMain(meta) {
  const filePath = path.join(root, "desktop", "main.js");
  let content = fs.readFileSync(filePath, "utf8");
  content = replaceOrThrow(content, /"backend", "[^"]+\.exe"/, `"backend", "${meta.internalName}.exe"`, "backend exe path");
  content = replaceOrThrow(
    content,
    /dialog\.showErrorBox\(\r?\n\s*"[^\"]+",/g,
    `dialog.showErrorBox(\n      "${meta.displayName}",`,
    "dialog title"
  );
  content = replaceOrThrow(
    content,
    /<div class="app-name">[\s\S]*?<\/div>/,
    '<div class="app-name">${splashLogoUrl ? `<img src="${splashLogoUrl}" alt="" />` : ""}<span>' + meta.displayName + '</span></div>',
    "splash title"
  );
  writeText(filePath, content);
}

function syncReadme(meta) {
  const filePath = path.join(root, "README.md");
  let content = fs.readFileSync(filePath, "utf8");
  content = replaceOrThrow(content, /%APPDATA%\\[A-Za-z0-9 _-]+/, `%APPDATA%\\${meta.internalName}`, "README appdata path");
  content = replaceOrThrow(
    content,
    /dist\\+[^\\`]+\\+[^\\`]+\.exe/,
    `dist\\${meta.internalName}\\${meta.internalName}.exe`,
    "README exe path"
  );
  writeText(filePath, content);
}

function validateMeta(meta) {
  const required = ["internalName", "displayName", "version", "appId", "publisher"];
  for (const key of required) {
    if (!meta[key] || typeof meta[key] !== "string") {
      throw new Error(`app_meta.json missing string field: ${key}`);
    }
  }
}

function main() {
  const metaPath = path.join(root, "app_meta.json");
  const meta = readJson(metaPath);
  validateMeta(meta);

  syncDesktopPackage(meta);
  syncFrontendPackage(meta);
  syncRootPackage(meta);
  syncPyInstallerSpec(meta);
  syncInnoScript(meta);
  syncRuntimePaths(meta);
  syncDesktopMain(meta);
  syncReadme(meta);
  syncBrandingAssets();

  process.stdout.write(`Synced metadata from ${path.relative(root, metaPath)}\n`);
}

main();