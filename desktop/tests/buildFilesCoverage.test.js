const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function resolveLocalRequire(fromFile, request) {
  const basePath = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.cjs`,
    path.join(basePath, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function collectLocalRequires(entryFile) {
  const requires = new Set();
  const visited = new Set();
  const queue = [entryFile];
  const requirePattern = /require\(\s*["'](\.[^"']+)["']\s*\)/g;

  while (queue.length > 0) {
    const currentFile = queue.pop();
    if (!currentFile || visited.has(currentFile)) {
      continue;
    }

    visited.add(currentFile);
    const source = fs.readFileSync(currentFile, "utf8");
    let match = null;

    while ((match = requirePattern.exec(source)) !== null) {
      const resolved = resolveLocalRequire(currentFile, match[1]);
      assert.ok(
        resolved,
        `Could not resolve local require ${match[1]} from ${toPosixPath(path.relative(desktopDir, currentFile))}`
      );

      const relPath = toPosixPath(path.relative(desktopDir, resolved));
      requires.add(relPath);
      if (!visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return requires;
}

function isCoveredByBuildFiles(relPath, fileGlobs) {
  const includeGlobs = fileGlobs.filter((pattern) => typeof pattern === "string" && !pattern.startsWith("!"));
  const excludeGlobs = fileGlobs
    .filter((pattern) => typeof pattern === "string" && pattern.startsWith("!"))
    .map((pattern) => pattern.slice(1));

  const included = includeGlobs.some((pattern) => globToRegex(toPosixPath(pattern)).test(relPath));
  if (!included) {
    return false;
  }

  const excluded = excludeGlobs.some((pattern) => globToRegex(toPosixPath(pattern)).test(relPath));
  return !excluded;
}

test("desktop main-process local modules are covered by build.files", () => {
  const packageJsonPath = path.join(desktopDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const fileGlobs = packageJson.build && Array.isArray(packageJson.build.files) ? packageJson.build.files : [];

  assert.ok(fileGlobs.length > 0, "desktop/package.json build.files must be a non-empty array");

  const entryFile = path.join(desktopDir, "main.js");
  const requiredModules = collectLocalRequires(entryFile);
  requiredModules.add("main.js");

  const missing = Array.from(requiredModules)
    .filter((relPath) => !isCoveredByBuildFiles(relPath, fileGlobs))
    .sort();

  assert.deepEqual(
    missing,
    [],
    [
      "desktop/package.json build.files does not include all local main-process modules.",
      `Missing: ${missing.join(", ")}`,
      `build.files: ${JSON.stringify(fileGlobs)}`,
    ].join("\n")
  );
});
