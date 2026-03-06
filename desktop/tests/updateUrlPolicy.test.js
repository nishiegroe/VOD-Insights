const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveBackendOrigin,
  shouldInjectApiTokenHeader,
  isLoopbackHost,
  isAllowedUpdateHost,
  validateInstallerDownloadUrl,
} = require("../updateUrlPolicy");

test("resolveBackendOrigin returns canonical origin for valid backend config", () => {
  assert.equal(
    resolveBackendOrigin({ protocol: "http:", host: "127.0.0.1", port: 5170 }),
    "http://127.0.0.1:5170"
  );
});

test("resolveBackendOrigin rejects malformed backend config", () => {
  assert.equal(resolveBackendOrigin({ protocol: "ftp:", host: "127.0.0.1", port: 5170 }), null);
  assert.equal(resolveBackendOrigin({ protocol: "http:", host: "", port: 5170 }), null);
  assert.equal(resolveBackendOrigin({ protocol: "http:", host: "127.0.0.1", port: "nope" }), null);
  assert.equal(resolveBackendOrigin({ protocol: "http:", host: "127.0.0.1", port: 70000 }), null);
});

test("shouldInjectApiTokenHeader only allows exact backend origin", () => {
  const backendOrigin = "http://127.0.0.1:5170";
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://127.0.0.1:5170/api/status",
      backendOrigin,
      "http://127.0.0.1:5170/home"
    ),
    true
  );
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://localhost:5170/api/status",
      backendOrigin,
      "http://127.0.0.1:5170/home"
    ),
    false
  );
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://127.0.0.1:5171/api/status",
      backendOrigin,
      "http://127.0.0.1:5170/home"
    ),
    false
  );
  assert.equal(
    shouldInjectApiTokenHeader(
      "https://127.0.0.1:5170/api/status",
      backendOrigin,
      "http://127.0.0.1:5170/home"
    ),
    false
  );
});

test("shouldInjectApiTokenHeader rejects unknown/malformed request and backend URLs", () => {
  assert.equal(shouldInjectApiTokenHeader("http://127.0.0.1:5170/api", null, "http://127.0.0.1:5170"), false);
  assert.equal(shouldInjectApiTokenHeader("not-a-url", "http://127.0.0.1:5170", "http://127.0.0.1:5170"), false);
  assert.equal(shouldInjectApiTokenHeader("http://127.0.0.1:5170/api", "not-a-url", "http://127.0.0.1:5170"), false);
});

test("shouldInjectApiTokenHeader rejects non-loopback backend origins", () => {
  assert.equal(
    shouldInjectApiTokenHeader("https://example.com/api/status", "https://example.com", "https://example.com/home"),
    false
  );
});

test("shouldInjectApiTokenHeader requires trusted backend initiator or referrer", () => {
  const backendOrigin = "http://127.0.0.1:5170";
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://127.0.0.1:5170/api/status",
      backendOrigin,
      "http://evil.example"
    ),
    false
  );
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://127.0.0.1:5170/api/status",
      backendOrigin,
      "",
      "http://127.0.0.1:5170/settings"
    ),
    true
  );
  assert.equal(
    shouldInjectApiTokenHeader(
      "http://127.0.0.1:5170/api/status",
      backendOrigin
    ),
    false
  );
});

test("isLoopbackHost accepts only expected loopback hostnames", () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("0.0.0.0"), false);
  assert.equal(isLoopbackHost("example.com"), false);
});

test("isAllowedUpdateHost allows expected GitHub hosts", () => {
  assert.equal(isAllowedUpdateHost("github.com"), true);
  assert.equal(isAllowedUpdateHost("objects.githubusercontent.com"), true);
  assert.equal(isAllowedUpdateHost("release-assets.githubusercontent.com"), true);
});

test("isAllowedUpdateHost rejects non-allowlisted hosts", () => {
  assert.equal(isAllowedUpdateHost("example.com"), false);
  assert.equal(isAllowedUpdateHost("github.com.evil.example"), false);
  assert.equal(isAllowedUpdateHost(""), false);
});

test("validateInstallerDownloadUrl accepts allowlisted HTTPS URL", () => {
  const parsed = validateInstallerDownloadUrl(
    "https://github.com/nishiegroe/VOD-Insights/releases/download/v1.0.10/VOD-Insights-Setup-1.0.10.exe"
  );
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "github.com");
});

test("validateInstallerDownloadUrl rejects non-HTTPS URL", () => {
  assert.throws(
    () => validateInstallerDownloadUrl("http://github.com/nishiegroe/VOD-Insights/releases/latest"),
    /must use HTTPS/
  );
});

test("validateInstallerDownloadUrl rejects non-allowlisted host", () => {
  assert.throws(
    () => validateInstallerDownloadUrl("https://example.com/download.exe"),
    /host is not allowed/
  );
});

test("validateInstallerDownloadUrl rejects invalid URL input", () => {
  assert.throws(() => validateInstallerDownloadUrl("not a url"), /is invalid/);
});