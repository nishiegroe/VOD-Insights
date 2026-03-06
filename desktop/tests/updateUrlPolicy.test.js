const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedUpdateHost, validateInstallerDownloadUrl } = require("../updateUrlPolicy");

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